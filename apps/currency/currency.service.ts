import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../auth-service/src/modules/tenants/tenant.entity';
import { Currency, CurrencyStatus } from './entities/currency.entity';
import { Wallet } from './entities/wallet.entity';
import {
  UpdateTenantSettingsDto,
  CreateOrganizationCurrencyDto,
  AddOrganizationMemberDto,
  MintTokensDto,
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

  async createCurrency(tenantId: string, dto: CreateOrganizationCurrencyDto): Promise<Currency> {
    const symbolExists = await this.currencyRepo.findOne({
      where: { tenantId, symbol: dto.symbol.toUpperCase() },
    });
    if (symbolExists) throw new ConflictException(`Symbol "${dto.symbol}" already exists in this tenant`);

    const currency = this.currencyRepo.create({
      tenantId,
      name: dto.name,
      symbol: dto.symbol.toUpperCase(),
      totalSupply: dto.initialSupply,
      circulatingSupply: dto.initialSupply,
      color: dto.color,
      expiryDays: dto.expiryDays,
      earnRules: dto.earnRules ?? {},
      status: CurrencyStatus.ACTIVE,
    });

    return this.currencyRepo.save(currency);
  }

  async getCurrency(currencyId: string, tenantId: string): Promise<Currency> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId, tenantId } });
    if (!currency) throw new NotFoundException('Currency not found');
    return currency;
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
}
