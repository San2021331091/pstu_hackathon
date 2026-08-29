import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private transfers: TransfersService) {}

  // F2 - initiate a friction-scored send (opens a cancellable countdown)
  @Post()
  initiate(@CurrentUser() user: { userId: string }, @Body() dto: CreateTransferDto) {
    return this.transfers.initiate({
      senderUserId: user.userId,
      recipientPhone: dto.recipientPhone,
      amountTaka: dto.amount,
      note: dto.note,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Get('pending')
  pending(@CurrentUser() user: { userId: string }) {
    return this.transfers.pending(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.transfers.get(user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.transfers.cancel(user.userId, id);
  }

  // Called when the countdown reaches zero; runs validator consensus.
  @Post(':id/finalize')
  finalize(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.transfers.finalize(user.userId, id);
  }
}
