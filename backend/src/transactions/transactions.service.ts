import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { poishaToTaka } from '../common/money';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * A user's statement, read directly from the append-only ledger (source of
   * truth). Cursor-paginated so it stays fast at 10M+ users / huge histories.
   */
  async history(userId: string, limit = 20, cursor?: string) {
    const account = await this.prisma.account.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found');

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        transfer: {
          include: {
            sender: { select: { id: true, name: true, phone: true } },
            receiver: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    const hasMore = entries.length > limit;
    const page = hasMore ? entries.slice(0, limit) : entries;

    const items = page.map((e) => {
      const credit = e.amount > 0n;
      let counterparty: { name: string; phone: string } | null = null;
      let title = 'Transaction';

      const other = e.transfer ? (credit ? e.transfer.sender : e.transfer.receiver) : null;
      if (other) counterparty = { name: other.name, phone: other.phone };

      switch (e.type) {
        case 'SIGNUP_BONUS':
          title = 'Signup bonus';
          break;
        case 'AGENT_CASH_IN':
          title = 'Cash-in from agent';
          break;
        case 'TRANSFER_HOLD':
          title = other ? `Sent to ${other.name} (held)` : 'Send held';
          break;
        case 'TRANSFER_IN':
          title = other ? `Received from ${other.name}` : 'Received';
          break;
        case 'TRANSFER_REFUND':
          title = other ? `Refund (${other.name})` : 'Refund';
          break;
        case 'GROUP_FUND_OUT':
          title = 'Funded community wallet';
          break;
        case 'GROUP_SPEND_IN':
          title = 'Community wallet payout';
          break;
        default:
          title = credit ? 'Received' : 'Sent';
      }

      return {
        id: e.id,
        type: e.type,
        direction: credit ? 'CREDIT' : 'DEBIT',
        title,
        note: e.transfer?.note ?? null,
        counterparty,
        amountTaka: poishaToTaka(e.amount > 0n ? e.amount : -e.amount),
        signedAmountTaka: poishaToTaka(e.amount),
        balanceAfterTaka: poishaToTaka(e.balanceAfter),
        createdAt: e.createdAt,
      };
    });

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
