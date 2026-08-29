import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { takaToPoisha, poishaToTaka } from '../common/money';
import { CreateGroupDto, CreateProposalDto } from './dto/group.dtos';

/**
 * Community Wallet / DAO (F4). A shared wallet whose funds no single member can
 * move alone: a spend must be proposed and pass a majority Yes vote. This is
 * the multisig-treasury (Gnosis Safe, t-of-n) pattern at app layer.
 */
@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  private async assertMember(groupId: string, userId: string) {
    const m = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this group');
  }

  async create(creatorId: string, dto: CreateGroupDto) {
    const phones = [...new Set(dto.memberPhones)];
    const users = await this.prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true },
    });
    const foundPhones = new Set(users.map((u) => u.phone));
    const missing = phones.filter((p) => !foundPhones.has(p));
    if (missing.length) {
      throw new BadRequestException(`Unknown member phone(s): ${missing.join(', ')}`);
    }
    const memberIds = new Set<string>([creatorId, ...users.map((u) => u.id)]);

    const group = await this.prisma.groupWallet.create({
      data: {
        name: dto.name,
        members: { create: [...memberIds].map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: { name: true, phone: true } } } } },
    });
    return this.shape(group);
  }

  async listMine(userId: string) {
    const groups = await this.prisma.groupWallet.findMany({
      where: { members: { some: { userId } } },
      include: { members: { include: { user: { select: { name: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return groups.map((g) => this.shape(g));
  }

  async get(userId: string, groupId: string) {
    await this.assertMember(groupId, userId);
    const group = await this.prisma.groupWallet.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: { select: { name: true, phone: true } } } },
        proposals: {
          orderBy: { createdAt: 'desc' },
          include: {
            proposer: { select: { name: true, phone: true } },
            votes: { include: { voter: { select: { name: true, phone: true } } } },
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    const recipientIds = group.proposals.map((p) => p.recipientId);
    const recipients = await this.prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, name: true, phone: true },
    });
    const rMap = new Map(recipients.map((r) => [r.id, r]));
    const memberCount = group.members.length;
    const majority = Math.floor(memberCount / 2) + 1;
    return {
      ...this.shape(group),
      majorityNeeded: majority,
      proposals: group.proposals.map((p) => {
        const yes = p.votes.filter((v) => v.approve).length;
        const no = p.votes.filter((v) => !v.approve).length;
        const r = rMap.get(p.recipientId);
        return {
          id: p.id,
          status: p.status,
          amountTaka: poishaToTaka(p.amount),
          reason: p.reason,
          recipient: r ? { name: r.name, phone: r.phone } : undefined,
          proposer: p.proposer,
          yes,
          no,
          majorityNeeded: majority,
          votes: p.votes.map((v) => ({ voter: v.voter, approve: v.approve })),
          createdAt: p.createdAt,
        };
      }),
    };
  }

  /** A member moves personal balance into the shared wallet. */
  async fund(userId: string, groupId: string, amountTaka: string) {
    await this.assertMember(groupId, userId);
    const amount = takaToPoisha(amountTaka);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "GroupWallet" WHERE id = ${groupId} FOR UPDATE`,
      );
      await this.ledger.lockAccounts(tx, [userId]);
      await this.ledger.debit(tx, {
        userId,
        amount,
        type: 'GROUP_FUND_OUT',
        memo: `funded group ${groupId}`,
      });
      const g = await tx.groupWallet.update({
        where: { id: groupId },
        data: { balance: { increment: amount } },
      });
      return { ok: true, groupBalanceTaka: poishaToTaka(g.balance) };
    });
  }

  async propose(userId: string, groupId: string, dto: CreateProposalDto) {
    await this.assertMember(groupId, userId);
    const amount = takaToPoisha(dto.amount);
    const recipient = await this.prisma.user.findUnique({
      where: { phone: dto.recipientPhone },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');
    const p = await this.prisma.proposal.create({
      data: {
        groupId,
        proposerId: userId,
        amount,
        recipientId: recipient.id,
        reason: dto.reason,
      },
    });
    return { id: p.id, status: p.status };
  }

  /**
   * Vote yes/no. When Yes votes reach a majority of members, the proposal
   * executes exactly once (proposal row locked FOR UPDATE): group balance is
   * debited and the recipient credited. No single member can move funds alone.
   */
  async vote(userId: string, proposalId: string, approve: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new NotFoundException('Proposal not found');
      const member = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: proposal.groupId, userId } },
      });
      if (!member) throw new ForbiddenException('You are not a member of this group');

      await tx.proposalVote.upsert({
        where: { proposalId_voterId: { proposalId, voterId: userId } },
        update: { approve },
        create: { proposalId, voterId: userId, approve },
      });

      // Lock the proposal row so a threshold-crossing vote executes once.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Proposal" WHERE id = ${proposalId} FOR UPDATE`,
      );
      const fresh = await tx.proposal.findUnique({
        where: { id: proposalId },
        include: { votes: true, group: { include: { members: true } } },
      });
      if (!fresh || fresh.status !== 'OPEN') {
        return { status: fresh?.status ?? 'UNKNOWN' };
      }

      const memberCount = fresh.group.members.length;
      const majority = Math.floor(memberCount / 2) + 1;
      const yes = fresh.votes.filter((v) => v.approve).length;
      const no = fresh.votes.filter((v) => !v.approve).length;

      if (no >= majority) {
        await tx.proposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' } });
        return { status: 'REJECTED', yes, no, majority };
      }

      if (yes >= majority) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "GroupWallet" WHERE id = ${fresh.groupId} FOR UPDATE`,
        );
        if (fresh.group.balance < fresh.amount) {
          throw new BadRequestException('Group wallet has insufficient balance');
        }
        await tx.groupWallet.update({
          where: { id: fresh.groupId },
          data: { balance: { decrement: fresh.amount } },
        });
        await this.ledger.lockAccounts(tx, [fresh.recipientId]);
        await this.ledger.credit(tx, {
          userId: fresh.recipientId,
          amount: fresh.amount,
          type: 'GROUP_SPEND_IN',
          memo: `group spend: ${fresh.reason}`,
        });
        await tx.proposal.update({ where: { id: proposalId }, data: { status: 'EXECUTED' } });
        return { status: 'EXECUTED', yes, no, majority };
      }

      return { status: 'OPEN', yes, no, majority };
    });
  }

  private shape(g: any) {
    return {
      id: g.id,
      name: g.name,
      balanceTaka: poishaToTaka(g.balance),
      members: g.members.map((m: any) => ({ name: m.user.name, phone: m.user.phone })),
      memberCount: g.members.length,
      createdAt: g.createdAt,
    };
  }
}
