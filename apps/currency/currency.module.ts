import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { OrganizationCurrency } from './entities/organization-currency.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, OrganizationCurrency, OrganizationMembership]),
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
