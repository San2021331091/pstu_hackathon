import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RiskService } from '../risk/risk.service';
import { ValidatorsService } from '../validators/validators.service';
import { takaToPoisha, poishaToTaka } from '../common/money';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private risk: RiskService,
    private validators: ValidatorsService,
  ) {}

  private view(t: any) {
    return {
      id: t.id,
      status: t.status,
      amountTaka: poishaToTaka(t.amount),
      note: t.note,
      riskScore: t.riskScore,
      delaySeconds: t.delaySeconds,
      reasons: t.reasons,
      executeAt: t.executeAt,
      finalizedAt: t.finalizedAt,
      createdAt: t.createdAt,
      sender: t.sender ? { name: t.sender.name, phone: t.sender.phone } : undefined,
      receiver: t.receiver ? { name: t.receiver.name, phone: t.receiver.phone } : undefined,
      requestId: t.requestId ?? undefined,
    };
  }

  /**
   * F2 - INITIATE a send. Scores risk, reserves funds out of the sender into a
   * HOLD (so they can't be double-spent during the window), and opens a
   * cancellable friction countdown. Nothing reaches the recipient until the
   * window expires and validators reach consensus in finalize().
   *
   * Can be composed by the money-request flow by passing requestId + a caller tx.
   */
  async initiate(
    input: {
      senderUserId: string;
      recipientPhone: string;
      amountTaka?: string;
      amountPoisha?: bigint;
      note?: string;
      idempotencyKey: string;
      requestId?: string;
    },
    outerTx?: Tx,
  ) {
    const amount =
      input.amountPoisha !== undefined
        ? input.amountPoisha
        : takaToPoisha(input.amountTaka ?? '0');
    if (amount <= 0n) throw new BadRequestException('Amount must be greater than zero');

    const sender = await (outerTx ?? this.prisma).user.findUnique({
      where: { id: input.senderUserId },
    });
    if (!sender) throw new NotFoundException('Sender not found');
    if (sender.frozen) {
      throw new ForbiddenException('Account is frozen. Unfreeze with your PIN to send money.');
    }

    const recipient = await (outerTx ?? this.prisma).user.findUnique({
      where: { phone: input.recipientPhone },
      select: { id: true, name: true, phone: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (recipient.id === sender.id) throw new BadRequestException('Cannot send to yourself');

    const run = async (tx: Tx) => {
      // Idempotency: a retried initiate returns the original pending transfer.
      const prior = await tx.transfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { sender: true, receiver: true },
      });
      if (prior) return { transfer: this.view(prior), deduped: true };

      const risk = await this.risk.score({
        senderUserId: sender.id,
        receiverUserId: recipient.id,
        amountPoisha: amount,
        client: tx,
      });

      // Reserve funds NOW (lock sender, debit to HOLD). This is what makes the
      // window safe: the money is already out of spendable balance.
      await this.ledger.lockAccounts(tx, [sender.id]);
      const { entry: holdEntry } = await this.ledger.debit(tx, {
        userId: sender.id,
        amount,
        type: 'TRANSFER_HOLD',
        memo: `hold for send to ${recipient.phone}`,
      });

      const executeAt = new Date(Date.now() + risk.delaySeconds * 1000);
      const created = await tx.transfer.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          senderId: sender.id,
          receiverId: recipient.id,
          amount,
          note: input.note,
          status: 'PENDING',
          riskScore: risk.score,
          delaySeconds: risk.delaySeconds,
          reasons: risk.reasons,
          executeAt,
          requestId: input.requestId,
        },
        include: { sender: true, receiver: true },
      });

      // Link the HOLD ledger row to this transfer for a clean audit trail.
      await tx.ledgerEntry.update({
        where: { id: holdEntry.id },
        data: { transferId: created.id },
      });

      return { transfer: this.view(created), deduped: false, dualConfirm: risk.dualConfirm };
    };

    if (outerTx) return run(outerTx);
    return this.prisma.$transaction(run, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  /** List the caller's in-window (PENDING) outgoing transfers. */
  async pending(userId: string) {
    const rows = await this.prisma.transfer.findMany({
      where: { senderId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { sender: true, receiver: true },
    });
    return rows.map((r) => this.view(r));
  }

  async get(userId: string, id: string) {
    const t = await this.prisma.transfer.findUnique({
      where: { id },
      include: { sender: true, receiver: true, validatorBallots: { include: { validator: true } } },
    });
    if (!t || (t.senderId !== userId && t.receiverId !== userId)) {
      throw new NotFoundException('Transfer not found');
    }
    return {
      ...this.view(t),
      ballots: t.validatorBallots.map((b) => ({
        validator: b.validator.name,
        ban: b.ban,
        reason: b.reason ?? undefined,
      })),
    };
  }

  /** F2 - cancel during the friction window: refund the hold to the sender. */
  async cancel(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Transfer not found');
      if (t.senderId !== userId) throw new ForbiddenException('Not your transfer');
      if (t.status !== 'PENDING') throw new BadRequestException(`Transfer already ${t.status}`);

      await this.ledger.lockAccounts(tx, [t.senderId]);
      await this.ledger.credit(tx, {
        userId: t.senderId,
        amount: t.amount,
        type: 'TRANSFER_REFUND',
        transferId: t.id,
        memo: 'cancelled by sender - hold refunded',
      });
      const updated = await tx.transfer.update({
        where: { id: t.id },
        data: { status: 'CANCELLED' },
        include: { sender: true, receiver: true },
      });
      return this.view(updated);
    });
  }

  /**
   * F2/F3 - finalize after the window. Validators run 2-of-3 consensus:
   *  - banned  -> refund the sender (funds never reach a suspicious recipient)
   *  - passed  -> credit the recipient, mark FINALIZED, settle any linked request
   */
  async finalize(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.transfer.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Transfer not found');
      if (t.senderId !== userId) throw new ForbiddenException('Not your transfer');
      if (t.status !== 'PENDING') throw new BadRequestException(`Transfer already ${t.status}`);
      if (t.executeAt && t.executeAt.getTime() > Date.now()) {
        const secsLeft = Math.ceil((t.executeAt.getTime() - Date.now()) / 1000);
        throw new BadRequestException(`Still in friction window (${secsLeft}s left)`);
      }

      const consensus = await this.validators.runConsensus(tx, t);

      if (consensus.banned) {
        await this.ledger.lockAccounts(tx, [t.senderId]);
        await this.ledger.credit(tx, {
          userId: t.senderId,
          amount: t.amount,
          type: 'TRANSFER_REFUND',
          transferId: t.id,
          memo: `banned by validators (${consensus.banVotes}/${consensus.total}) - refunded`,
        });
        const updated = await tx.transfer.update({
          where: { id: t.id },
          data: { status: 'BANNED', finalizedAt: new Date() },
          include: { sender: true, receiver: true },
        });
        return { transfer: this.view(updated), consensus };
      }

      // Passed consensus: deliver to recipient.
      await this.ledger.lockAccounts(tx, [t.receiverId]);
      await this.ledger.credit(tx, {
        userId: t.receiverId,
        amount: t.amount,
        type: 'TRANSFER_IN',
        transferId: t.id,
        memo: t.note ?? undefined,
      });
      const updated = await tx.transfer.update({
        where: { id: t.id },
        data: { status: 'FINALIZED', finalizedAt: new Date() },
        include: { sender: true, receiver: true },
      });
      if (t.requestId) {
        await tx.moneyRequest.update({
          where: { id: t.requestId },
          data: { status: 'PAID', transferId: t.id },
        });
      }
      return { transfer: this.view(updated), consensus };
    });
  }
}
