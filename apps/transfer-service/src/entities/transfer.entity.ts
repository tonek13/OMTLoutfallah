import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

export enum TransferStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED  = 'COMPLETED',
  FAILED     = 'FAILED',
  CANCELLED  = 'CANCELLED',
  REVERSED   = 'REVERSED',
}

export enum TransferType {
  DOMESTIC      = 'DOMESTIC',
  INTERNATIONAL = 'INTERNATIONAL',
  WALLET        = 'WALLET',
}

export enum Currency {
  LBP = 'LBP',
  USD = 'USD',
  EUR = 'EUR',
}

@Entity('transfers')
@Index(['senderId'])
@Index(['receiverPhone'])
@Index(['status'])
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  receiverPhone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  receiverName: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  feeAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  totalAmount: number;   // amount + feeAmount

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'enum', enum: TransferType })
  type: TransferType;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({ type: 'varchar', length: 20, unique: true })
  referenceCode: string;  // e.g. OMT-2024-XXXXXX

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  senderIp: string;

  @Column({ type: 'boolean', default: false })
  isFlagged: boolean;        // fraud flag

  @Column({ type: 'text', nullable: true })
  flagReason: string;

  @Column({ type: 'varchar', nullable: true })
  cancelledBy: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
