import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../auth-service/src/modules/tenants/tenant.entity';
import { Currency, CurrencyStatus } from './entities/currency.entity';
import { Wallet } from './entities/wallet.entity';
import { AuditLog } from './entities/audit-log.entity';
import {
  UpdateTenantSettingsDto,
  CreateOrganizationCurrencyDto,
  UpdateCurrencyDto,
  AddOrganizationMemberDto,
  MintTokensDto,
  MintCurrencyToRecipientDto,
  BurnCurrencyDto,
  CurrencyTransactionsQueryDto,
  CurrencyTransactionType,
} from './dto/currency.dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(Currency)
    private readonly currencyRepo: Repository<Currency>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly dataSource: DataSource,
  ) {}

  async listTenantsForUser(userId: string, tenantId: string): Promise<Tenant[]> {
    return this.tenantRepo
      .createQueryBuilder('tenant')
      .where('tenant."ownerUserId" = :userId', { userId })
      .orWhere('tenant.id = :tenantId', { tenantId })
      .orderBy('tenant.createdAt', 'DESC')
      .getMany();
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(tenantId: string, updates: UpdateTenantSettingsDto): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    if (updates.name !== undefined) {
      tenant.name = updates.name;
    }
    if (updates.logo !== undefined) {
      tenant.logo = updates.logo;
    }
    if (updates.primaryColor !== undefined) {
      tenant.primaryColor = updates.primaryColor;
    }
    return this.tenantRepo.save(tenant);
  }

  // CURRENCIES

  async createCurrency(
    tenantId: string,
    adminUserId: string,
    dto: CreateOrganizationCurrencyDto,
  ): Promise<Currency> {
    return this.dataSource.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, { where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');

      const normalizedSymbol = dto.symbol.trim().toUpperCase();
      const symbolExists = await manager
        .createQueryBuilder(Currency, 'currency')
        .where('currency.tenantId = :tenantId', { tenantId })
        .andWhere('UPPER(currency.symbol) = :symbol', { symbol: normalizedSymbol })
        .getCount();
      if (symbolExists > 0) {
        throw new ConflictException(`Symbol "${dto.symbol}" already exists in this tenant`);
      }

      const currency = manager.create(Currency, {
        tenantId,
        name: dto.name,
        symbol: normalizedSymbol,
        totalSupply: dto.initialSupply,
        circulatingSupply: dto.initialSupply,
        color: dto.color,
        expiryDays: dto.expiryDays,
        earnRules: dto.earnRules ?? {},
        status: CurrencyStatus.ACTIVE,
      });

      const savedCurrency = await manager.save(Currency, currency);

      const adminWallet = manager.create(Wallet, {
        userId: adminUserId,
        tenantId,
        currencyId: savedCurrency.id,
        balance: dto.initialSupply,
        frozenBalance: 0,
      });
      await manager.save(Wallet, adminWallet);

      return savedCurrency;
    });
  }

  async updateCurrency(
    currencyId: string,
    actorUserId: string,
    actorTenantId: string,
    dto: UpdateCurrencyDto,
  ): Promise<Currency> {
    return this.dataSource.transaction(async (manager) => {
      const currency = await manager.findOne(Currency, {
        where: { id: currencyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currency) {
        throw new NotFoundException('Currency not found');
      }
      if (currency.tenantId !== actorTenantId) {
        throw new ForbiddenException('Tenant admin access denied');
      }

      if (dto.symbol !== undefined) {
        const normalizedSymbol = dto.symbol.trim().toUpperCase();
        if (normalizedSymbol !== currency.symbol) {
          const walletCount = await manager.count(Wallet, {
            where: { tenantId: actorTenantId, currencyId: currency.id },
          });
          if (walletCount > 0) {
            throw new ConflictException('Cannot change symbol after first wallet is created');
          }

          const symbolExists = await manager
            .createQueryBuilder(Currency, 'currency')
            .where('currency.tenantId = :tenantId', { tenantId: actorTenantId })
            .andWhere('UPPER(currency.symbol) = :symbol', { symbol: normalizedSymbol })
            .andWhere('currency.id <> :currencyId', { currencyId: currency.id })
            .getCount();

          if (symbolExists > 0) {
            throw new ConflictException(`Symbol "${dto.symbol}" already exists in this tenant`);
          }

          currency.symbol = normalizedSymbol;
        }
      }

      if (dto.name !== undefined) {
        currency.name = dto.name;
      }
      if (dto.color !== undefined) {
        currency.color = dto.color;
      }
      if (dto.expiryDays !== undefined) {
        currency.expiryDays = dto.expiryDays;
      }
      if (dto.earnRules !== undefined) {
        this.validateEarnRulesSchema(dto.earnRules);
        currency.earnRules = dto.earnRules;
      }

      const updatedCurrency = await manager.save(Currency, currency);

      const auditLog = manager.create(AuditLog, {
        tenantId: actorTenantId,
        actorUserId,
        eventType: 'currency.updated',
        entityType: 'currency',
        entityId: updatedCurrency.id,
        payload: {
          updatedFields: Object.keys(dto),
        },
      });

      await manager.save(AuditLog, auditLog);
      return updatedCurrency;
    });
  }

  async getCurrency(currencyId: string, tenantId: string): Promise<Currency> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId, tenantId } });
    if (!currency) throw new NotFoundException('Currency not found');
    return currency;
  }

  async getCurrencyStats(
    currencyId: string,
    requesterTenantId: string,
  ): Promise<{
    name: string;
    symbol: string;
    circulatingSupply: number;
    totalWallets: number;
    totalTransfers: number;
  }> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException('Currency not found');

    if (currency.tenantId !== requesterTenantId) {
      throw new ForbiddenException('You are not a member of this tenant');
    }

    const [totalWallets, totalTransfers] = await Promise.all([
      this.walletRepo.count({ where: { tenantId: currency.tenantId, currencyId: currency.id } }),
      this.countTransfersForCurrency(currency.tenantId, currency.symbol),
    ]);

    return {
      name: currency.name,
      symbol: currency.symbol,
      circulatingSupply: Number(currency.circulatingSupply),
      totalWallets,
      totalTransfers,
    };
  }

  async getCurrencyTransactions(
    currencyId: string,
    requesterTenantId: string,
    query: CurrencyTransactionsQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      type: CurrencyTransactionType;
      actor: { id: string; phone?: string | null; email?: string | null };
      amount: number;
      reason: string | null;
      timestamp: Date;
    }>;
    meta: { total: number; page: number; limit: number; pages: number };
  }> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException('Currency not found');
    if (currency.tenantId !== requesterTenantId) {
      throw new ForbiddenException('Tenant admin access denied');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const type = query.type;

    const includeMint = !type || type === CurrencyTransactionType.MINT;
    const includeBurn = !type || type === CurrencyTransactionType.BURN;
    const includeTransfer = !type || type === CurrencyTransactionType.TRANSFER;

    const [mintTx, burnTx, transferTx] = await Promise.all([
      includeMint
        ? this.fetchAuditTransactions(requesterTenantId, currencyId, 'currency.minted', CurrencyTransactionType.MINT)
        : Promise.resolve([]),
      includeBurn
        ? this.fetchAuditTransactions(requesterTenantId, currencyId, 'currency.burned', CurrencyTransactionType.BURN)
        : Promise.resolve([]),
      includeTransfer
        ? this.fetchTransferTransactions(requesterTenantId, currency.symbol)
        : Promise.resolve([]),
    ]);

    const transactions = [...mintTx, ...burnTx, ...transferTx]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const data = transactions.slice(startIndex, startIndex + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCurrencyPanelStats(
    currencyId: string,
    requesterTenantId: string,
  ): Promise<{
    totalMinted: number;
    totalBurned: number;
    totalTransfers: number;
    activeWallets: number;
    dailyVolume: Array<{ date: string; volume: number }>;
  }> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException('Currency not found');
    if (currency.tenantId !== requesterTenantId) {
      throw new ForbiddenException('Tenant admin access denied');
    }

    const [totalMinted, totalBurned, totalTransfers, activeWallets, dailyVolume] = await Promise.all([
      this.sumAuditAmounts(requesterTenantId, currencyId, 'currency.minted'),
      this.sumAuditAmounts(requesterTenantId, currencyId, 'currency.burned'),
      this.countTransfersForCurrency(requesterTenantId, currency.symbol),
      this.countActiveWallets(requesterTenantId, currencyId),
      this.buildDailyTransferVolume(requesterTenantId, currency.symbol, 30),
    ]);

    return {
      totalMinted,
      totalBurned,
      totalTransfers,
      activeWallets,
      dailyVolume,
    };
  }

  async listCurrencies(tenantId: string): Promise<Currency[]> {
    return this.currencyRepo.find({ where: { tenantId } });
  }

  // MEMBERSHIPS / WALLETS

  async addMember(tenantId: string, currencyId: string, dto: AddOrganizationMemberDto): Promise<Wallet> {
    await this.getCurrency(currencyId, tenantId);

    const existing = await this.walletRepo.findOne({
      where: { userId: dto.userId, currencyId },
    });
    if (existing) throw new ConflictException('User already has a wallet for this currency');

    const wallet = this.walletRepo.create({
      userId: dto.userId,
      tenantId,
      currencyId,
      balance: 0,
      frozenBalance: 0,
    });

    return this.walletRepo.save(wallet);
  }

  async getMyWallet(userId: string, tenantId: string): Promise<Wallet[]> {
    return this.walletRepo.find({
      where: { userId, tenantId },
      relations: ['currency'],
    });
  }

  // MINT TOKENS

  async mintTokens(tenantId: string, dto: MintTokensDto): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: dto.membershipId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Membership not found');

      const currency = await manager.findOne(Currency, {
        where: { id: wallet.currencyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currency) throw new NotFoundException('Currency not found');

      wallet.balance = Number(wallet.balance) + dto.amount;
      currency.circulatingSupply = Number(currency.circulatingSupply) + dto.amount;

      await manager.save(Currency, currency);
      return manager.save(Wallet, wallet);
    });
  }

  async mintCurrencyToRecipient(
    currencyId: string,
    actorUserId: string,
    actorTenantId: string,
    dto: MintCurrencyToRecipientDto,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const currency = await manager.findOne(Currency, {
        where: { id: currencyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currency) throw new NotFoundException('Currency not found');
      if (currency.tenantId !== actorTenantId) {
        throw new ForbiddenException('Tenant admin access denied');
      }

      const wallet = await manager.findOne(Wallet, {
        where: {
          tenantId: actorTenantId,
          currencyId,
          userId: dto.recipientId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException('Recipient wallet not found for this currency');
      }

      const previousWalletBalance = Number(wallet.balance);
      const previousCirculatingSupply = Number(currency.circulatingSupply);

      wallet.balance = previousWalletBalance + dto.amount;
      currency.circulatingSupply = previousCirculatingSupply + dto.amount;

      const updatedCurrency = await manager.save(Currency, currency);
      const updatedWallet = await manager.save(Wallet, wallet);

      const auditLog = manager.create(AuditLog, {
        tenantId: actorTenantId,
        actorUserId,
        eventType: 'currency.minted',
        entityType: 'wallet',
        entityId: updatedWallet.id,
        payload: {
          currencyId,
          recipientId: dto.recipientId,
          amount: dto.amount,
          reason: dto.reason ?? null,
          walletBalanceBefore: previousWalletBalance,
          walletBalanceAfter: Number(updatedWallet.balance),
          circulatingSupplyBefore: previousCirculatingSupply,
          circulatingSupplyAfter: Number(updatedCurrency.circulatingSupply),
        },
      });

      await manager.save(AuditLog, auditLog);

      return updatedWallet;
    });
  }

  async burnCurrencyFromAdmin(
    currencyId: string,
    actorUserId: string,
    actorTenantId: string,
    dto: BurnCurrencyDto,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const currency = await manager.findOne(Currency, {
        where: { id: currencyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currency) throw new NotFoundException('Currency not found');
      if (currency.tenantId !== actorTenantId) {
        throw new ForbiddenException('Tenant admin access denied');
      }

      const adminWallet = await manager.findOne(Wallet, {
        where: {
          tenantId: actorTenantId,
          currencyId,
          userId: actorUserId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adminWallet) {
        throw new NotFoundException('Admin wallet not found for this currency');
      }

      const previousWalletBalance = Number(adminWallet.balance);
      const previousCirculatingSupply = Number(currency.circulatingSupply);

      if (previousWalletBalance < dto.amount) {
        throw new BadRequestException('Insufficient admin wallet balance');
      }
      if (previousCirculatingSupply < dto.amount) {
        throw new BadRequestException('Insufficient circulating supply');
      }

      adminWallet.balance = previousWalletBalance - dto.amount;
      currency.circulatingSupply = previousCirculatingSupply - dto.amount;

      const updatedCurrency = await manager.save(Currency, currency);
      const updatedWallet = await manager.save(Wallet, adminWallet);

      const auditLog = manager.create(AuditLog, {
        tenantId: actorTenantId,
        actorUserId,
        eventType: 'currency.burned',
        entityType: 'wallet',
        entityId: updatedWallet.id,
        payload: {
          currencyId,
          amount: dto.amount,
          reason: dto.reason ?? null,
          walletBalanceBefore: previousWalletBalance,
          walletBalanceAfter: Number(updatedWallet.balance),
          circulatingSupplyBefore: previousCirculatingSupply,
          circulatingSupplyAfter: Number(updatedCurrency.circulatingSupply),
        },
      });

      await manager.save(AuditLog, auditLog);

      return updatedWallet;
    });
  }

  private async countTransfersForCurrency(tenantId: string, symbol: string): Promise<number> {
    try {
      const rows = await this.dataSource.query(
        `
          SELECT COUNT(*)::int AS "totalTransfers"
          FROM transfers t
          WHERE t."tenantId" = $1
            AND t.currency::text = $2
        `,
        [tenantId, symbol],
      );

      return Number(rows?.[0]?.totalTransfers ?? 0);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('relation "transfers" does not exist')) {
        return 0;
      }

      throw error;
    }
  }

  private async fetchAuditTransactions(
    tenantId: string,
    currencyId: string,
    eventType: 'currency.minted' | 'currency.burned',
    type: CurrencyTransactionType.MINT | CurrencyTransactionType.BURN,
  ): Promise<Array<{
    id: string;
    type: CurrencyTransactionType;
    actor: { id: string; phone?: string | null; email?: string | null };
    amount: number;
    reason: string | null;
    timestamp: Date;
  }>> {
    try {
      const rows = await this.dataSource.query(
        `
          SELECT
            a.id::text AS id,
            a."actorUserId" AS "actorId",
            u.phone AS "actorPhone",
            u.email AS "actorEmail",
            COALESCE((a.payload ->> 'amount')::numeric, 0) AS amount,
            NULLIF(a.payload ->> 'reason', '') AS reason,
            a."createdAt" AS "timestamp"
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a."actorUserId"
          WHERE a."tenantId" = $1
            AND a."eventType" = $2
            AND a.payload ->> 'currencyId' = $3
        `,
        [tenantId, eventType, currencyId],
      );

      return rows.map((row: any) => ({
        id: String(row.id),
        type,
        actor: {
          id: String(row.actorId),
          phone: row.actorPhone ?? null,
          email: row.actorEmail ?? null,
        },
        amount: Number(row.amount),
        reason: row.reason ?? null,
        timestamp: new Date(row.timestamp),
      }));
    } catch (error: unknown) {
      if (this.isMissingRelation(error, 'audit_logs') || this.isMissingRelation(error, 'users')) {
        return [];
      }

      throw error;
    }
  }

  private async fetchTransferTransactions(
    tenantId: string,
    symbol: string,
  ): Promise<Array<{
    id: string;
    type: CurrencyTransactionType;
    actor: { id: string; phone?: string | null; email?: string | null };
    amount: number;
    reason: string | null;
    timestamp: Date;
  }>> {
    try {
      const rows = await this.dataSource.query(
        `
          SELECT
            t.id::text AS id,
            t."senderId" AS "actorId",
            u.phone AS "actorPhone",
            u.email AS "actorEmail",
            t.amount AS amount,
            t.note AS reason,
            t."createdAt" AS "timestamp"
          FROM transfers t
          LEFT JOIN users u ON u.id = t."senderId"
          WHERE t."tenantId" = $1
            AND t.currency::text = $2
        `,
        [tenantId, symbol],
      );

      return rows.map((row: any) => ({
        id: String(row.id),
        type: CurrencyTransactionType.TRANSFER,
        actor: {
          id: String(row.actorId),
          phone: row.actorPhone ?? null,
          email: row.actorEmail ?? null,
        },
        amount: Number(row.amount),
        reason: row.reason ?? null,
        timestamp: new Date(row.timestamp),
      }));
    } catch (error: unknown) {
      if (this.isMissingRelation(error, 'transfers') || this.isMissingRelation(error, 'users')) {
        return [];
      }

      throw error;
    }
  }

  private async sumAuditAmounts(
    tenantId: string,
    currencyId: string,
    eventType: 'currency.minted' | 'currency.burned',
  ): Promise<number> {
    try {
      const rows = await this.dataSource.query(
        `
          SELECT COALESCE(SUM((a.payload ->> 'amount')::numeric), 0) AS total
          FROM audit_logs a
          WHERE a."tenantId" = $1
            AND a."eventType" = $2
            AND a.payload ->> 'currencyId' = $3
        `,
        [tenantId, eventType, currencyId],
      );

      return Number(rows?.[0]?.total ?? 0);
    } catch (error: unknown) {
      if (this.isMissingRelation(error, 'audit_logs')) {
        return 0;
      }

      throw error;
    }
  }

  private async countActiveWallets(tenantId: string, currencyId: string): Promise<number> {
    return this.walletRepo
      .createQueryBuilder('wallet')
      .where('wallet.tenantId = :tenantId', { tenantId })
      .andWhere('wallet.currencyId = :currencyId', { currencyId })
      .andWhere('wallet.balance > 0')
      .getCount();
  }

  private async buildDailyTransferVolume(
    tenantId: string,
    symbol: string,
    days: number,
  ): Promise<Array<{ date: string; volume: number }>> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const dateKeys: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - i);
      dateKeys.push(date.toISOString().slice(0, 10));
    }

    const startDate = dateKeys[0];
    const endDateExclusive = new Date(today);
    endDateExclusive.setUTCDate(today.getUTCDate() + 1);
    const endDate = endDateExclusive.toISOString().slice(0, 10);

    let rows: Array<{ day: string; volume: string | number }> = [];
    try {
      rows = await this.dataSource.query(
        `
          SELECT
            DATE(t."createdAt")::text AS day,
            COALESCE(SUM(t.amount), 0) AS volume
          FROM transfers t
          WHERE t."tenantId" = $1
            AND t.currency::text = $2
            AND t."createdAt" >= $3::date
            AND t."createdAt" < $4::date
          GROUP BY DATE(t."createdAt")
        `,
        [tenantId, symbol, startDate, endDate],
      );
    } catch (error: unknown) {
      if (this.isMissingRelation(error, 'transfers')) {
        return dateKeys.map((date) => ({ date, volume: 0 }));
      }

      throw error;
    }

    const volumeByDay = new Map<string, number>();
    for (const row of rows) {
      volumeByDay.set(String(row.day), Number(row.volume ?? 0));
    }

    return dateKeys.map((date) => ({
      date,
      volume: volumeByDay.get(date) ?? 0,
    }));
  }

  private validateEarnRulesSchema(earnRules: unknown): void {
    if (!this.isPlainObject(earnRules)) {
      throw new BadRequestException('earnRules must be a JSON object');
    }

    const numericRewardFields = ['basePoints', 'points', 'pointsPerDollar', 'multiplier'] as const;
    for (const [ruleKey, ruleValue] of Object.entries(earnRules)) {
      if (!this.isPlainObject(ruleValue)) {
        throw new BadRequestException(`earnRules.${ruleKey} must be a JSON object`);
      }

      const rule = ruleValue as Record<string, unknown>;
      const hasNumericRewardField = numericRewardFields.some(
        (field) => rule[field] !== undefined,
      );
      if (!hasNumericRewardField) {
        throw new BadRequestException(
          `earnRules.${ruleKey} must include one reward field: ${numericRewardFields.join(', ')}`,
        );
      }

      for (const field of numericRewardFields) {
        const fieldValue = rule[field];
        if (fieldValue !== undefined && !this.isNonNegativeNumber(fieldValue)) {
          throw new BadRequestException(`earnRules.${ruleKey}.${field} must be a non-negative number`);
        }
      }

      if (rule.maxPerDay !== undefined) {
        if (!Number.isInteger(rule.maxPerDay) || Number(rule.maxPerDay) < 1) {
          throw new BadRequestException(`earnRules.${ruleKey}.maxPerDay must be an integer >= 1`);
        }
      }

      if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
        throw new BadRequestException(`earnRules.${ruleKey}.enabled must be boolean`);
      }

      if (rule.activityType !== undefined) {
        if (typeof rule.activityType !== 'string' || rule.activityType.trim().length === 0) {
          throw new BadRequestException(`earnRules.${ruleKey}.activityType must be a non-empty string`);
        }
      }

      if (rule.conditions !== undefined) {
        if (!this.isPlainObject(rule.conditions)) {
          throw new BadRequestException(`earnRules.${ruleKey}.conditions must be a JSON object`);
        }

        for (const [conditionKey, conditionValue] of Object.entries(rule.conditions)) {
          if (
            typeof conditionValue !== 'string'
            && typeof conditionValue !== 'number'
            && typeof conditionValue !== 'boolean'
            && conditionValue !== null
          ) {
            throw new BadRequestException(
              `earnRules.${ruleKey}.conditions.${conditionKey} must be string, number, boolean, or null`,
            );
          }
        }
      }
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNonNegativeNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  private isMissingRelation(error: unknown, relationName: string): boolean {
    const message = error instanceof Error ? error.message : '';
    return message.includes(`relation "${relationName}" does not exist`)
      || message.includes(`relation '${relationName}' does not exist`);
  }
}
