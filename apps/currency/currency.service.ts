import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
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
  AddOrganizationMemberDto,
  MintTokensDto,
  MintCurrencyToRecipientDto,
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
}
