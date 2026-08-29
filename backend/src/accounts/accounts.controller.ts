import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';

class PinDto {
  @Matches(/^\d{4,6}$/, { message: 'pin must be 4-6 digits' })
  pin: string;
}
class UnfreezeDto {
  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'pin must be 4-6 digits' })
  pin?: string;
}

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.accounts.me(user.userId);
  }

  @Get('lookup')
  lookup(@CurrentUser() user: AuthUser, @Query('phone') phone: string) {
    return this.accounts.lookupByPhone(phone, user.userId);
  }

  @Post('pin')
  setPin(@CurrentUser() user: AuthUser, @Body() dto: PinDto) {
    return this.accounts.setPin(user.userId, dto.pin);
  }

  @Post('freeze')
  freeze(@CurrentUser() user: AuthUser) {
    return this.accounts.freeze(user.userId);
  }

  @Post('unfreeze')
  unfreeze(@CurrentUser() user: AuthUser, @Body() dto: UnfreezeDto) {
    return this.accounts.unfreeze(user.userId, dto.pin);
  }
}
