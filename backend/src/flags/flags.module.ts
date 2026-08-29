import { Module } from '@nestjs/common';
import { FlagsService } from './flags.service';
import { FlagsController } from './flags.controller';

@Module({ providers: [FlagsService], controllers: [FlagsController] })
export class FlagsModule {}
