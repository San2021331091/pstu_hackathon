import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LedgerService } from './ledger.service';

// Ledger explorer (F6). Public-ish within the app; guarded to logged-in users.
@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private ledger: LedgerService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.ledger.list(limit ? parseInt(limit, 10) : 50);
  }

  @Get('verify')
  verify() {
    return this.ledger.verifyChain();
  }
}
