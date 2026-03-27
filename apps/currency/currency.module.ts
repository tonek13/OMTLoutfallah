import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../auth-service/src/modules/tenants/tenant.entity';
import { Currency } from './entities/currency.entity';
import { Wallet } from './entities/wallet.entity';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { TenantAdminGuard } from 'apps/auth-service/src/guards/tenant-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Currency, Wallet]),
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService, TenantAdminGuard],
  exports: [CurrencyService],
})
export class CurrencyModule {}
