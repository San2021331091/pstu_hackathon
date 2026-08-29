import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LedgerModule } from './ledger/ledger.module';
import { RiskModule } from './risk/risk.module';
import { ValidatorsModule } from './validators/validators.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransfersModule } from './transfers/transfers.module';
import { RequestsModule } from './requests/requests.module';
import { TransactionsModule } from './transactions/transactions.module';
import { FlagsModule } from './flags/flags.module';
import { AgentModule } from './agent/agent.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,       // @Global: hash-chained ledger primitive
    RiskModule,
    ValidatorsModule,   // vote-to-ban + health dashboard
    AuthModule,
    AccountsModule,     // balance, freeze/unfreeze, PIN
    TransfersModule,    // friction lifecycle
    RequestsModule,
    TransactionsModule,
    FlagsModule,        // report accounts (feeds R4)
    AgentModule,        // cash-in
    GroupsModule,       // community wallet / DAO
  ],
})
export class AppModule {}
