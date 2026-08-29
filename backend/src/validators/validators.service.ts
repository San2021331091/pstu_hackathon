import { Injectable } from '@nestjs/common';
import { Prisma, Transfer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ConsensusResult {
  banned: boolean;
  banVotes: number;
  total: number;
  threshold: number;
  ballots: { validator: string; ban: boolean; reason?: string }[];
}

/**
 * Validator network (F3 / §9.1). A small set of independent nodes each
 * inspect a pending transfer and vote. This is a demo-scale stand-in for
 * purpose-built payment consensus (Ripple RCPA / Stellar SCP / PBFT-family),
 * which likewise require a supermajority rather than a bare 51%. Here: 3 nodes,
 * 2-of-3 to ban (supermajority) before a transfer can finalize.
 */
@Injectable()
export class ValidatorsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.validator.findMany({ orderBy: { name: 'asc' } });
  }

  /** Each online validator independently decides whether to ban the transfer. */
  async runConsensus(
    tx: Prisma.TransactionClient,
    transfer: Transfer,
  ): Promise<ConsensusResult> {
    const validators = await tx.validator.findMany({ where: { online: true } });
    const flagCount = await tx.flag.count({ where: { flaggedId: transfer.receiverId } });

    // A transfer is "suspicious" if the recipient is widely reported or the
    // risk score is extreme. Independent nodes reach the same signal.
    const suspicious = flagCount >= 3 || transfer.riskScore >= 90;
    const reason = suspicious
      ? flagCount >= 3
        ? `recipient reported by ${flagCount} users`
        : `risk score ${transfer.riskScore}`
      : undefined;

    const ballots: { validator: string; ban: boolean; reason?: string }[] = [];
    let banVotes = 0;
    for (const v of validators) {
      const ban = suspicious;
      if (ban) banVotes++;
      await tx.validatorVote.create({
        data: { transferId: transfer.id, validatorId: v.id, ban, reason: ban ? reason : null },
      });
      await tx.validator.update({
        where: { id: v.id },
        data: { votesCast: { increment: 1 } },
      });
      ballots.push({ validator: v.name, ban, reason: ban ? reason : undefined });
    }

    const threshold = Math.floor(validators.length / 2) + 1; // 2-of-3
    return { banned: banVotes >= threshold, banVotes, total: validators.length, threshold, ballots };
  }
}
