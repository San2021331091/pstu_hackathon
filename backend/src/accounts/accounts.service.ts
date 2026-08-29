import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { poishaToTaka } from '../common/money';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async me(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, accountType: true, frozen: true, pinHash: true },
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return {
      id: account.user.id,
      name: account.user.name,
      phone: account.user.phone,
      accountType: account.user.accountType,
      isAgent: account.user.accountType === 'AGENT',
      frozen: account.user.frozen,
      hasPin: !!account.user.pinHash,
      balancePoisha: account.balance.toString(),
      balanceTaka: poishaToTaka(account.balance),
    };
  }

  async lookupByPhone(phone: string, excludeUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true },
    });
    if (!user || user.id === excludeUserId) {
      throw new NotFoundException('No user with that phone number');
    }
    return user;
  }

  /** F5 - set/replace the 4-6 digit PIN used to unfreeze. */
  async setPin(userId: string, pin: string) {
    if (!/^\d{4,6}$/.test(pin)) throw new BadRequestException('PIN must be 4-6 digits');
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: await bcrypt.hash(pin, 10) },
    });
    return { ok: true, hasPin: true };
  }

  /**
   * F5 - Emergency Freeze: one tap cancels ALL in-window outgoing transfers
   * (refunding each held amount) and locks the account from new sends.
   */
  async freeze(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.transfer.findMany({
        where: { senderId: userId, status: 'PENDING' },
      });
      await this.ledger.lockAccounts(tx, [userId]);
      for (const t of pending) {
        await this.ledger.credit(tx, {
          userId,
          amount: t.amount,
          type: 'TRANSFER_REFUND',
          transferId: t.id,
          memo: 'emergency freeze - hold refunded',
        });
        await tx.transfer.update({ where: { id: t.id }, data: { status: 'CANCELLED' } });
      }
      await tx.user.update({ where: { id: userId }, data: { frozen: true } });
      return { frozen: true, cancelledTransfers: pending.length };
    });
  }

  /** F5 - unfreeze, gated by the PIN so a grabbed device can't simply toggle it. */
  async unfreeze(userId: string, pin?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.pinHash) {
      if (!pin) throw new BadRequestException('PIN required to unfreeze');
      const ok = await bcrypt.compare(pin, user.pinHash);
      if (!ok) throw new ForbiddenException('Incorrect PIN');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { frozen: false } });
    return { frozen: false };
  }
}
