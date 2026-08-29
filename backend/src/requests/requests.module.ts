import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [TransfersModule],
  providers: [RequestsService],
  controllers: [RequestsController],
})
export class RequestsModule {}
