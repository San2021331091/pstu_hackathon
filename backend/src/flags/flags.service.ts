import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Flag registry. When 3+ distinct users report the same account, Risk Engine
 * rule R4 fires and validators will vote-to-ban transfers to that account (F3).
 */
@Injectable()
export class FlagsService {
  constructor(private prisma: PrismaService) {}

  async flag(reporterId: string, phone: string, reason: string) {
    const target = await this.prisma.user.findUnique({ where: { phone } });
    if (!target) throw new NotFoundException('No user with that phone number');
    if (target.id === reporterId) throw new BadRequestException('You cannot flag yourself');

    await this.prisma.flag.upsert({
      where: { flaggedId_flaggedById: { flaggedId: target.id, flaggedById: reporterId } },
      update: { reason },
      create: { flaggedId: target.id, flaggedById: reporterId, reason },
    });
    const count = await this.prisma.flag.count({ where: { flaggedId: target.id } });
    return { ok: true, phone, reports: count, riskRuleR4Active: count >= 3 };
  }

  async countFor(phone: string) {
    const target = await this.prisma.user.findUnique({ where: { phone } });
    if (!target) throw new NotFoundException('No user with that phone number');
    const count = await this.prisma.flag.count({ where: { flaggedId: target.id } });
    return { phone, reports: count, riskRuleR4Active: count >= 3 };
  }
}
