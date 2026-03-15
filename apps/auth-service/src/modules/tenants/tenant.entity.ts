import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  slug!: string;

  @Column({ nullable: true })
  logo!: string;

  @Column({ nullable: true, length: 7 })
  primaryColor!: string;

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
}
