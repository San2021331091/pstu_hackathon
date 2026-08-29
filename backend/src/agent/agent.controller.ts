import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AgentService } from './agent.service';

class CashInDto {
  @Matches(/^01\d{9}$/, { message: 'targetPhone must be a valid BD number' })
  targetPhone: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a number' })
  @IsString()
  amount: string;
}

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private agent: AgentService) {}

  @Post('cash-in')
  cashIn(@CurrentUser() user: AuthUser, @Body() dto: CashInDto) {
    return this.agent.cashIn(user.userId, dto.targetPhone, dto.amount);
  }
}
