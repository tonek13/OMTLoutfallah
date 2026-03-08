import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum UserRole {
  CUSTOMER   = 'customer',
  AGENT      = 'agent',
  ADMIN      = 'admin',
  SUPERADMIN = 'superadmin',
}

export enum UserStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
  BLOCKED   = 'blocked',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Index({ unique: true })
  @Column()
  phone!: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  email!: string | null;

  @Column()
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ default: false })
  phoneVerified!: boolean;

  @Column({ default: false })
  twoFactorEnabled!: boolean;

  @Column({ nullable: true })
  twoFactorSecret!: string | null;

  @Column({ nullable: true })
  refreshTokenHash!: string | null;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ nullable: true })
  lockedUntil!: Date | null;

  @Column({ nullable: true })
  lastLoginAt!: Date | null;

  @Column({ nullable: true })
  lastLoginIp!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ default: false })
  emailVerified!: boolean;
}
