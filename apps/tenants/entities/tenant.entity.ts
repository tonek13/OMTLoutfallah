import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, Index,
} from 'typeorm';
import { OrganizationCurrency } from '../../currency/entities/organization-currency.entity';
import { OrganizationMembership } from '../../currency/entities/organization-membership.entity';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

export enum TenantPlan {
  STARTER = 'starter',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ length: 60 })
  slug!: string; // e.g. "aub", "deloitte-lb" - used for subdomain

  @Column({ nullable: true })
  logo!: string;

  @Column({ nullable: true, length: 7 })
  primaryColor!: string; // hex e.g. "#c9a84c"

  @Column({ type: 'enum', enum: TenantPlan, default: TenantPlan.STARTER })
  plan!: TenantPlan;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.TRIAL })
  status!: TenantStatus;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => OrganizationMembership, (m) => m.tenant)
  memberships!: OrganizationMembership[];

  @OneToMany(() => OrganizationCurrency, (c) => c.tenant)
  currencies!: OrganizationCurrency[];
}
