import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private ledger: LedgerService,
  ) {}

  private signupBonus(): bigint {
    return BigInt(process.env.SIGNUP_BONUS_POISHA || '10000000'); // BDT 100,000
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) throw new ConflictException('Phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 10) : null;
    const bonus = this.signupBonus();

    // user + account + opening SIGNUP_BONUS ledger entry, atomically. The
    // opening entry is hash-chained like every other movement (F6).
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          pinHash,
          accountType: dto.accountType ?? 'USER',
        },
      });
      // Start at 0; the SIGNUP_BONUS credit sets the opening balance and writes
      // the genesis-linked ledger row in the same atomic step.
      await tx.account.create({ data: { userId: u.id, balance: 0n } });
      await this.ledger.credit(tx, {
        userId: u.id,
        amount: bonus,
        type: 'SIGNUP_BONUS',
        memo: 'welcome bonus',
      });
      return u;
    });

    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }

  private issueToken(user: {
    id: string;
    phone: string;
    name: string;
    accountType?: string;
  }) {
    const token = this.jwt.sign({
      sub: user.id,
      phone: user.phone,
      name: user.name,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        accountType: (user as any).accountType ?? 'USER',
      },
    };
  }
}
