import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ledgerHash, GENESIS_HASH, poishaToTaka } from '../common/money';

export type Tx = Prisma.TransactionClient;

export interface EntryInput {
  accountId: string;
  type:
    | 'SIGNUP_BONUS'
    | 'AGENT_CASH_IN'
    | 'TRANSFER_HOLD'
    | 'TRANSFER_IN'
    | 'TRANSFER_REFUND'
    | 'GROUP_FUND_OUT'
    | 'GROUP_SPEND_IN';
  amount: bigint;        // signed poisha
  balanceAfter: bigint;
  transferId?: string | null;
  memo?: string | null;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Append one hash-chained, immutable ledger row. Each row commits to the
   * hash of the previous row (SHA-256), so any later edit is detectable.
   * Note (hackathon scope): the global chain read-then-append can theoretically
   * fork under heavy concurrency; production would use a per-account chain or a
   * dedicated append sequencer. seq (autoincrement) still stays monotonic.
   */
  async append(tx: Tx, e: EntryInput) {
    const last = await tx.ledgerEntry.findFirst({ orderBy: { seq: 'desc' } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const createdAt = new Date();
    const hash = ledgerHash({
      prevHash,
      accountId: e.accountId,
      type: e.type,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      transferId: e.transferId ?? null,
      memo: e.memo ?? null,
      createdAtIso: createdAt.toISOString(),
    });
    return tx.ledgerEntry.create({
      data: {
        accountId: e.accountId,
        type: e.type as any,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        transferId: e.transferId ?? null,
        memo: e.memo ?? null,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  /** Lock account rows FOR UPDATE in deterministic order (deadlock-free). */
  async lockAccounts(tx: Tx, userIds: string[]) {
    const ordered = [...new Set(userIds)].sort();
    if (ordered.length === 0) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Account"
                 WHERE "userId" IN (${Prisma.join(ordered)})
                 ORDER BY "userId"
                 FOR UPDATE`,
    );
  }

  /** Debit a user (money leaves). Caller must have locked the account. */
  async debit(
    tx: Tx,
    p: { userId: string; amount: bigint; type: EntryInput['type']; transferId?: string; memo?: string },
  ) {
    if (p.amount <= 0n) throw new BadRequestException('Amount must be > 0');
    const acc = await tx.account.findUnique({ where: { userId: p.userId } });
    if (!acc) throw new NotFoundException('Account not found');
    if (acc.balance < p.amount) throw new BadRequestException('Insufficient balance');
    const balanceAfter = acc.balance - p.amount;
    await tx.account.update({ where: { id: acc.id }, data: { balance: balanceAfter } });
    const entry = await this.append(tx, {
      accountId: acc.id,
      type: p.type,
      amount: -p.amount,
      balanceAfter,
      transferId: p.transferId,
      memo: p.memo,
    });
    return { balanceAfter, entry };
  }

  /** Credit a user (money arrives). Caller must have locked the account. */
  async credit(
    tx: Tx,
    p: { userId: string; amount: bigint; type: EntryInput['type']; transferId?: string; memo?: string },
  ) {
    if (p.amount <= 0n) throw new BadRequestException('Amount must be > 0');
    const acc = await tx.account.findUnique({ where: { userId: p.userId } });
    if (!acc) throw new NotFoundException('Account not found');
    const balanceAfter = acc.balance + p.amount;
    await tx.account.update({ where: { id: acc.id }, data: { balance: balanceAfter } });
    const entry = await this.append(tx, {
      accountId: acc.id,
      type: p.type,
      amount: p.amount,
      balanceAfter,
      transferId: p.transferId,
      memo: p.memo,
    });
    return { balanceAfter, entry };
  }

  /** Explorer feed: newest-first page of the global chain. */
  async list(limit = 50) {
    const rows = await this.prisma.ledgerEntry.findMany({
      orderBy: { seq: 'desc' },
      take: Math.min(limit, 200),
      include: { account: { include: { user: { select: { name: true, phone: true } } } } },
    });
    return rows.map((r) => ({
      seq: r.seq,
      type: r.type,
      account: { name: r.account.user.name, phone: r.account.user.phone },
      amountTaka: poishaToTaka(r.amount),
      balanceAfterTaka: poishaToTaka(r.balanceAfter),
      memo: r.memo,
      prevHash: r.prevHash,
      hash: r.hash,
      createdAt: r.createdAt,
    }));
  }

  /** Walk the whole chain and recompute every hash to prove integrity (F6). */
  async verifyChain() {
    const rows = await this.prisma.ledgerEntry.findMany({ orderBy: { seq: 'asc' } });
    let prevHash = GENESIS_HASH;
    for (const r of rows) {
      const expected = ledgerHash({
        prevHash,
        accountId: r.accountId,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        transferId: r.transferId,
        memo: r.memo,
        createdAtIso: r.createdAt.toISOString(),
      });
      if (r.prevHash !== prevHash || r.hash !== expected) {
        return { valid: false, count: rows.length, brokenAtSeq: r.seq };
      }
      prevHash = r.hash;
    }
    return { valid: true, count: rows.length, headHash: prevHash };
  }
}
