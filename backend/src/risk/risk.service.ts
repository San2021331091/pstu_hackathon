import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { POISHA_PER_TAKA } from '../common/money';

export interface RiskResult {
  score: number;
  delaySeconds: number;
  reasons: string[];
  dualConfirm: boolean;
}

/**
 * Risk Engine (§7). Deterministic, additive rule scoring (R1-R6) - exactly how
 * most real fraud systems start (Chainalysis/TRM/Coinbase evolve this into
 * graph + ML scoring; that's the documented Phase 2). The countdown length is
 * proportional to the fired rules, mirroring crypto-exchange withdrawal holds.
 */
@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService) {}

  async score(p: {
    senderUserId: string;
    receiverUserId: string;
    amountPoisha: bigint;
    client?: Prisma.TransactionClient;
  }): Promise<RiskResult> {
    const db = p.client ?? this.prisma;
    const taka = Number(p.amountPoisha / POISHA_PER_TAKA);
    let score = 0;
    let delay = 0;
    const reasons: string[] = [];

    // R1 - first-time recipient (no prior finalized transfer to this account)
    const priorToRecipient = await db.transfer.count({
      where: {
        senderId: p.senderUserId,
        receiverId: p.receiverUserId,
        status: 'FINALIZED',
      },
    });
    if (priorToRecipient === 0) {
      score += 20;
      delay = Math.max(delay, 10);
      reasons.push('R1: first-time recipient (+20, 10s hold)');
    }

    // R2 / R3 - amount bands
    if (taka > 5000) {
      score += 40;
      delay = Math.max(delay, 60);
      reasons.push('R3: amount over ৳5,000 (+40, 60s hold + warning)');
    } else if (taka >= 1000) {
      score += 25;
      delay = Math.max(delay, 30);
      reasons.push('R2: amount ৳1,000-5,000 (+25, 30s hold + confirm)');
    }

    // R4 - recipient flagged by 3+ distinct users
    const flagCount = await db.flag.count({ where: { flaggedId: p.receiverUserId } });
    if (flagCount >= 3) {
      score += 45;
      delay = Math.max(delay, 120);
      reasons.push(`R4: recipient reported by ${flagCount} users (+45, 120s hold + red banner)`);
    }

    // R5 - 5+ transfers from this account within the last hour (velocity)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.transfer.count({
      where: { senderId: p.senderUserId, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 5) {
      score += 35;
      delay = Math.max(delay, 60);
      reasons.push(`R5: ${recentCount} sends in the last hour (+35, 60s hold)`);
    }

    // R6 - cumulative escalation
    let dualConfirm = false;
    if (score > 70) {
      delay = Math.max(delay, 120);
      dualConfirm = true;
      reasons.push('R6: cumulative risk over 70 - max hold + dual confirmation');
    }

    return { score, delaySeconds: delay, reasons, dualConfirm };
  }
}
