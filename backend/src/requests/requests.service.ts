import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { takaToPoisha, poishaToTaka } from '../common/money';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private transfers: TransfersService,
  ) {}

  /** "My friend owes me X. Collect it." Creates a PENDING money request. */
  async create(requesterId: string, dto: CreateRequestDto) {
    const amount = takaToPoisha(dto.amount);
    if (amount <= 0n) throw new BadRequestException('Amount must be > 0');

    const payer = await this.prisma.user.findUnique({
      where: { phone: dto.payerPhone },
      select: { id: true, name: true, phone: true },
    });
    if (!payer) throw new NotFoundException('That user does not exist');
    if (payer.id === requesterId) {
      throw new BadRequestException('You cannot request money from yourself');
    }

    const req = await this.prisma.moneyRequest.create({
      data: {
        requesterId,
        payerId: payer.id,
        amount,
        note: dto.note,
      },
      include: {
        requester: { select: { name: true, phone: true } },
        payer: { select: { name: true, phone: true } },
      },
    });
    return this.shape(req);
  }

  /** Requests I need to act on (someone is asking me to pay). */
  async incoming(userId: string) {
    const rows = await this.prisma.moneyRequest.findMany({
      where: { payerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { name: true, phone: true } },
        payer: { select: { name: true, phone: true } },
      },
    });
    return rows.map((r) => this.shape(r));
  }

  /** Requests I have sent out to collect money. */
  async outgoing(userId: string) {
    const rows = await this.prisma.moneyRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { name: true, phone: true } },
        payer: { select: { name: true, phone: true } },
      },
    });
    return rows.map((r) => this.shape(r));
  }

  /**
   * Payer approves a request. Per §11.2 this does NOT settle instantly - it
   * enters the SAME Risk Engine -> friction countdown -> validator pipeline as a
   * direct send. We open a PENDING friction transfer (payer -> requester) tied
   * to this request; when that transfer finalizes, finalize() flips the request
   * to PAID. The request row is locked so two approvals can't both open one.
   */
  async pay(requestId: string, payerUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "MoneyRequest" WHERE id = ${requestId} FOR UPDATE`,
        );

        const req = await tx.moneyRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new NotFoundException('Request not found');
        if (req.payerId !== payerUserId) {
          throw new ForbiddenException('This request is not addressed to you');
        }
        if (req.status !== 'PENDING') {
          throw new BadRequestException(`Request already ${req.status.toLowerCase()}`);
        }

        const requester = await tx.user.findUnique({
          where: { id: req.requesterId },
          select: { phone: true },
        });
        if (!requester) throw new NotFoundException('Requester not found');

        // Deterministic idempotency key tied to the request: retried approvals
        // return the same pending transfer instead of opening a second one.
        const result = await this.transfers.initiate(
          {
            senderUserId: req.payerId,
            recipientPhone: requester.phone,
            amountPoisha: req.amount,
            note: req.note ?? 'Request settlement',
            idempotencyKey: `request:${req.id}`,
            requestId: req.id,
          },
          tx,
        );
        return { request: this.shape(req), transfer: (result as any).transfer };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Payer declines a pending request. */
  async decline(requestId: string, payerUserId: string) {
    return this.transition(requestId, payerUserId, 'payer', 'DECLINED');
  }

  /** Requester cancels a pending request they created. */
  async cancel(requestId: string, requesterUserId: string) {
    return this.transition(requestId, requesterUserId, 'requester', 'CANCELLED');
  }

  private async transition(
    requestId: string,
    userId: string,
    role: 'payer' | 'requester',
    next: 'DECLINED' | 'CANCELLED',
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "MoneyRequest" WHERE id = ${requestId} FOR UPDATE`,
      );
      const req = await tx.moneyRequest.findUnique({ where: { id: requestId } });
      if (!req) throw new NotFoundException('Request not found');
      const ownerId = role === 'payer' ? req.payerId : req.requesterId;
      if (ownerId !== userId) throw new ForbiddenException('Not allowed');
      if (req.status !== 'PENDING') {
        throw new BadRequestException(`Request already ${req.status.toLowerCase()}`);
      }
      const updated = await tx.moneyRequest.update({
        where: { id: req.id },
        data: { status: next },
        include: {
          requester: { select: { name: true, phone: true } },
          payer: { select: { name: true, phone: true } },
        },
      });
      return this.shape(updated);
    });
  }

  private shape(r: any) {
    return {
      id: r.id,
      status: r.status,
      amountTaka: poishaToTaka(r.amount),
      note: r.note,
      requester: r.requester,
      payer: r.payer,
      createdAt: r.createdAt,
    };
  }
}
