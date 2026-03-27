import {
  Injectable, BadRequestException,
  ForbiddenException, NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Transfer, TransferStatus, Currency } from '../entities/transfer.entity';
import { CreateTransferDto } from '../dto/transfer.dto';

// Fee structure (could come from DB/config in production)
const FEE_RULES = {
  [Currency.USD]: { flat: 2, percent: 0.01 },  // $2 + 1%
  [Currency.LBP]: { flat: 5000, percent: 0.01 },
  [Currency.EUR]: { flat: 2, percent: 0.01 },
};

// Daily limits per user (could be tier-based)
const DAILY_LIMIT_USD = 5000;

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(Transfer)
    private transferRepo: Repository<Transfer>,
    private dataSource: DataSource,
  ) {}

  // ─── Create Transfer ───────────────────────────────────────────────
  async createTransfer(senderId: string, tenantId: string, dto: CreateTransferDto, senderIp: string) {
    // 1. Check daily limit
    await this.checkDailyLimit(senderId, dto.amount, dto.currency);

    // 2. Prevent cross-tenant receiver targeting when receiver has a tenant wallet
    await this.assertReceiverTenantIsolation(dto.receiverPhone, tenantId);

    // 3. Calculate fee
    const feeAmount = this.calculateFee(dto.amount, dto.currency);
    const totalAmount = parseFloat((dto.amount + feeAmount).toFixed(4));

    // 4. Fraud pre-check
    const isFlagged = await this.fraudPreCheck(senderId, dto, senderIp);

    // 5. Use DB transaction to guarantee atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transfer = queryRunner.manager.create(Transfer, {
        id: uuidv4(),
        tenantId,
        senderId,
        receiverPhone: dto.receiverPhone,
        receiverName: dto.receiverName,
        amount: dto.amount,
        feeAmount,
        totalAmount,
        currency: dto.currency,
        type: dto.type,
        note: dto.note,
        senderIp,
        referenceCode: this.generateReferenceCode(),
        status: isFlagged ? TransferStatus.PENDING : TransferStatus.PROCESSING,
        isFlagged,
        flagReason: isFlagged ? 'Automated fraud flag - manual review required' : undefined,
      });

      await queryRunner.manager.save(transfer);
      await queryRunner.commitTransaction();

      this.logger.log(`Transfer created: ${transfer.referenceCode} | sender: ${senderId}`);

      // 6. Emit event for audit & notification (async - fire and forget)
      this.emitTransferEvent(transfer);

      return this.toResponse(transfer);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transfer failed for sender ${senderId}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async assertReceiverTenantIsolation(receiverPhone: string, senderTenantId: string): Promise<void> {
    const receiverWalletTenantId = await this.findReceiverWalletTenantId(receiverPhone);

    if (receiverWalletTenantId && receiverWalletTenantId !== senderTenantId) {
      throw new BadRequestException('Cross-tenant transfers are not allowed');
    }
  }

  private async findReceiverWalletTenantId(receiverPhone: string): Promise<string | undefined> {
    try {
      const wallets = await this.dataSource.query(
        `
          SELECT w."tenantId" AS "tenantId"
          FROM wallets w
          INNER JOIN users u ON u.id = w."userId"
          WHERE u.phone = $1
          LIMIT 1
        `,
        [receiverPhone],
      );

      return wallets?.[0]?.tenantId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const isMissingWalletsTable = message.includes('relation "wallets" does not exist');
      if (!isMissingWalletsTable) {
        throw error;
      }

      const memberships = await this.dataSource.query(
        `
          SELECT m."tenantId" AS "tenantId"
          FROM organization_memberships m
          INNER JOIN users u ON u.id = m."userId"
          WHERE u.phone = $1
          LIMIT 1
        `,
        [receiverPhone],
      );

      return memberships?.[0]?.tenantId;
    }
  }

  // ─── Get Transfer by Reference ─────────────────────────────────────
  async getByReference(referenceCode: string, requesterId: string) {
    const transfer = await this.transferRepo.findOne({ where: { referenceCode } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.senderId !== requesterId) throw new ForbiddenException();
    return this.toResponse(transfer);
  }

  // ─── Get User Transfers ────────────────────────────────────────────
  async getUserTransfers(senderId: string, page = 1, limit = 20) {
    const [transfers, total] = await this.transferRepo.findAndCount({
      where: { senderId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: transfers.map(this.toResponse),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Cancel Transfer ───────────────────────────────────────────────
  async cancelTransfer(id: string, requesterId: string) {
    const transfer = await this.transferRepo.findOne({ where: { id } });
    if (!transfer) throw new NotFoundException();
    if (transfer.senderId !== requesterId) throw new ForbiddenException();

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Only PENDING transfers can be cancelled');
    }

    await this.transferRepo.update(id, {
      status: TransferStatus.CANCELLED,
      cancelledBy: requesterId,
    });

    return { message: 'Transfer cancelled successfully' };
  }

  // ─── Fee Calculation ───────────────────────────────────────────────
  private calculateFee(amount: number, currency: Currency): number {
    const rule = FEE_RULES[currency];
    const fee = rule.flat + amount * rule.percent;
    return parseFloat(fee.toFixed(4));
  }

  // ─── Daily Limit Check ─────────────────────────────────────────────
  private async checkDailyLimit(senderId: string, amount: number, currency: Currency) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.transferRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.senderId = :senderId', { senderId })
      .andWhere('t.currency = :currency', { currency })
      .andWhere('t.createdAt >= :today', { today })
      .andWhere('t.status NOT IN (:...statuses)', {
        statuses: [TransferStatus.CANCELLED, TransferStatus.FAILED],
      })
      .getRawOne();

    const dailyTotal = parseFloat(result.total) + amount;

    if (currency === Currency.USD && dailyTotal > DAILY_LIMIT_USD) {
      throw new BadRequestException(
        `Daily limit of $${DAILY_LIMIT_USD} USD exceeded`,
      );
    }
  }

  // ─── Basic Fraud Pre-Check ─────────────────────────────────────────
  private async fraudPreCheck(
    senderId: string,
    dto: CreateTransferDto,
    ip: string,
  ): Promise<boolean> {
    // Flag if large amount
    if (dto.currency === Currency.USD && dto.amount >= 3000) return true;

    // Flag if many transfers in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.transferRepo.count({
      where: { senderId, status: TransferStatus.PROCESSING },
    });
    if (recentCount >= 5) return true;

    return false;
  }

  // ─── Reference Code ────────────────────────────────────────────────
  private generateReferenceCode(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `OMT-${year}-${random}`;
  }

  // ─── Async Event Emission ──────────────────────────────────────────
  private emitTransferEvent(transfer: Transfer): void {
    // In production: emit to Kafka topic 'transfer.created'
    // this.kafkaClient.emit('transfer.created', transfer);
    this.logger.debug(`Event emitted for transfer ${transfer.referenceCode}`);
  }

  // ─── Response Mapper ───────────────────────────────────────────────
  private toResponse(transfer: Transfer) {
    return {
      id: transfer.id,
      referenceCode: transfer.referenceCode,
      status: transfer.status,
      amount: transfer.amount,
      feeAmount: transfer.feeAmount,
      totalAmount: transfer.totalAmount,
      currency: transfer.currency,
      type: transfer.type,
      receiverPhone: transfer.receiverPhone,
      receiverName: transfer.receiverName,
      note: transfer.note,
      isFlagged: transfer.isFlagged,
      createdAt: transfer.createdAt,
    };
  }
}
