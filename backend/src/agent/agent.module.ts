import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';

@Module({ providers: [AgentService], controllers: [AgentController] })
export class AgentModule {}
