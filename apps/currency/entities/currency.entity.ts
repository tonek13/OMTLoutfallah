import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Tenant } from '../../auth-service/src/modules/tenants/tenant.entity';
import { Wallet } from './wallet.entity';

export enum CurrencyStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.currencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ length: 120 })
  name!: string;

  @Index()
  @Column({ length: 10 })
  symbol!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalSupply!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  circulatingSupply!: number;

  @Column({ nullable: true, length: 7 })
  color!: string;

  @Column({ type: 'jsonb', nullable: true })
  earnRules!: Record<string, unknown>;

  @Column({ nullable: true })
  expiryDays!: number;

  @Column({
    type: 'enum',
    enum: CurrencyStatus,
    enumName: 'currencies_status_enum',
    default: CurrencyStatus.ACTIVE,
  })
  status!: CurrencyStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Wallet, (wallet) => wallet.currency)
  wallets!: Wallet[];
}
