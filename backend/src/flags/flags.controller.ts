import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { FlagsService } from './flags.service';

class FlagDto {
  @Matches(/^01\d{9}$/, { message: 'phone must be a valid BD number' })
  phone: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  reason: string;
}

@Controller('flags')
@UseGuards(JwtAuthGuard)
export class FlagsController {
  constructor(private flags: FlagsService) {}

  @Post()
  flag(@CurrentUser() user: AuthUser, @Body() dto: FlagDto) {
    return this.flags.flag(user.userId, dto.phone, dto.reason);
  }

  @Get()
  count(@Query('phone') phone: string) {
    return this.flags.countFor(phone);
  }
}
