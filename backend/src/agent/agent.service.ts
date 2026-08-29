import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { takaToPoisha, poishaToTaka } from '../common/money';

/**
 * F7 - Agent Network (Cash-In). A verified AGENT account converts a user's
 * physical cash into digital balance - the on-ramp into the system. Logged
 * distinctly (AGENT_CASH_IN) for reconciliation. Cash-Out is out of scope.
 * Real-world analogue: a Stellar "Anchor" / bKash-Nagad agent.
 */
@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async cashIn(agentUserId: string, targetPhone: string, amountTaka: string) {
    const agent = await this.prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.accountType !== 'AGENT') {
      throw new ForbiddenException('Only AGENT accounts can perform Cash-In');
    }
    const target = await this.prisma.user.findUnique({
      where: { phone: targetPhone },
      select: { id: true, name: true, phone: true },
    });
    if (!target) throw new NotFoundException('No user with that phone number');

    const amount = takaToPoisha(amountTaka);
    const newBalance = await this.prisma.$transaction(async (tx) => {
      await this.ledger.lockAccounts(tx, [target.id]);
      const { balanceAfter } = await this.ledger.credit(tx, {
        userId: target.id,
        amount,
        type: 'AGENT_CASH_IN',
        memo: `cash-in by agent ${agent.phone}`,
      });
      return balanceAfter;
    });

    return {
      ok: true,
      target: { name: target.name, phone: target.phone },
      amountTaka: poishaToTaka(amount),
      newBalanceTaka: poishaToTaka(newBalance),
    };
  }
}
