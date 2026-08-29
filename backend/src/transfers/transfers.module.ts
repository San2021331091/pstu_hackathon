import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { RiskModule } from '../risk/risk.module';
import { ValidatorsModule } from '../validators/validators.module';

@Module({
  imports: [RiskModule, ValidatorsModule],
  providers: [TransfersService],
  controllers: [TransfersController],
  exports: [TransfersService],
})
export class TransfersModule {}
