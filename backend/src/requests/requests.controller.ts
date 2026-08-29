import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private requests: RequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.requests.create(user.userId, dto);
  }

  @Get('incoming')
  incoming(@CurrentUser() user: AuthUser) {
    return this.requests.incoming(user.userId);
  }

  @Get('outgoing')
  outgoing(@CurrentUser() user: AuthUser) {
    return this.requests.outgoing(user.userId);
  }

  // Approving a request opens a friction transfer (payer -> requester); the
  // caller then finalizes that transfer like any other send.
  @Post(':id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.pay(id, user.userId);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.decline(id, user.userId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.cancel(id, user.userId);
  }
}
