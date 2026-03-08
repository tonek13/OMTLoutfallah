import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { OrganizationCurrency } from './organization-currency.entity';

export enum MembershipStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum MemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('organization_memberships')
@Unique(['userId', 'currencyId']) // one wallet per user per currency
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  currencyId!: string;

  @ManyToOne(() => Tenant, (t) => t.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => OrganizationCurrency, (c) => c.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currencyId' })
  currency!: OrganizationCurrency;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.MEMBER })
  role!: MemberRole;

  @Column({ type: 'enum', enum: MembershipStatus, default: MembershipStatus.ACTIVE })
  status!: MembershipStatus;

  // Wallet balance
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  frozenBalance!: number; // held during flagged transfers

  @CreateDateColumn()
  joinedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
