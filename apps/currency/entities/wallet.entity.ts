import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { Tenant } from '../../auth-service/src/modules/tenants/tenant.entity';
import { Currency } from './currency.entity';

@Entity('wallets')
@Unique('UQ_wallets_user_currency', ['userId', 'currencyId'])
@Index('IDX_wallets_tenantId', ['tenantId'])
@Index('IDX_wallets_currencyId', ['currencyId'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  currencyId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  frozenBalance!: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => Currency, (currency) => currency.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currencyId' })
  currency!: Currency;
}
