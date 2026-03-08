import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { OrganizationMembership } from './organization-membership.entity';

export enum CurrencyStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

@Entity('organization_currencies')
export class OrganizationCurrency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (t) => t.currencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ length: 120 })
  name!: string; // e.g. "Campus Coin"

  @Index()
  @Column({ length: 10 })
  symbol!: string; // e.g. "ACC"

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalSupply!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  circulatingSupply!: number;

  @Column({ nullable: true, length: 7 })
  color!: string; // hex brand color

  @Column({ type: 'jsonb', nullable: true })
  earnRules!: Record<string, any>; // flexible earn rule definitions

  @Column({ nullable: true })
  expiryDays!: number; // null = never expires

  @Column({ type: 'enum', enum: CurrencyStatus, default: CurrencyStatus.ACTIVE })
  status!: CurrencyStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => OrganizationMembership, (m) => m.currency)
  memberships!: OrganizationMembership[];
}
