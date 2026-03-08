import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant, TenantStatus, TenantPlan } from '../tenants/entities/tenant.entity';
import { OrganizationCurrency, CurrencyStatus } from './entities/organization-currency.entity';
import { OrganizationMembership, MemberRole } from './entities/organization-membership.entity';
import {
  CreateOrganizationDto,
  CreateOrganizationCurrencyDto,
  AddOrganizationMemberDto,
  MintTokensDto,
} from './dto/currency.dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(OrganizationCurrency)
    private readonly currencyRepo: Repository<OrganizationCurrency>,

    @InjectRepository(OrganizationMembership)
    private readonly membershipRepo: Repository<OrganizationMembership>,

    private readonly dataSource: DataSource,
  ) {}

  // TENANTS

  async createTenant(dto: CreateOrganizationDto, ownerUserId: string): Promise<Tenant> {
    const exists = await this.tenantRepo.findOne({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const tenant = this.tenantRepo.create({
      ...dto,
      ownerUserId,
      status: TenantStatus.TRIAL,
      plan: TenantPlan.STARTER,
    });

    return this.tenantRepo.save(tenant);
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(tenantId: string, ownerUserId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    if (tenant.ownerUserId !== ownerUserId) throw new ForbiddenException();
    Object.assign(tenant, updates);
    return this.tenantRepo.save(tenant);
  }

  // CURRENCIES

  async createCurrency(tenantId: string, dto: CreateOrganizationCurrencyDto): Promise<OrganizationCurrency> {
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

  async getCurrency(currencyId: string, tenantId: string): Promise<OrganizationCurrency> {
    const currency = await this.currencyRepo.findOne({ where: { id: currencyId, tenantId } });
    if (!currency) throw new NotFoundException('Currency not found');
    return currency;
  }

  async listCurrencies(tenantId: string): Promise<OrganizationCurrency[]> {
    return this.currencyRepo.find({ where: { tenantId } });
  }

  // MEMBERSHIPS / WALLETS

  async addMember(tenantId: string, currencyId: string, dto: AddOrganizationMemberDto): Promise<OrganizationMembership> {
    await this.getCurrency(currencyId, tenantId);

    const existing = await this.membershipRepo.findOne({
      where: { userId: dto.userId, currencyId },
    });
    if (existing) throw new ConflictException('User already has a wallet for this currency');

    const membership = this.membershipRepo.create({
      userId: dto.userId,
      tenantId,
      currencyId,
      role: MemberRole.MEMBER,
      balance: 0,
      frozenBalance: 0,
    });

    return this.membershipRepo.save(membership);
  }

  async getMyWallet(userId: string, tenantId: string): Promise<OrganizationMembership[]> {
    return this.membershipRepo.find({
      where: { userId, tenantId },
      relations: ['currency'],
    });
  }

  // MINT TOKENS

  async mintTokens(tenantId: string, dto: MintTokensDto): Promise<OrganizationMembership> {
    return this.dataSource.transaction(async (manager) => {
      const membership = await manager.findOne(OrganizationMembership, {
        where: { id: dto.membershipId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!membership) throw new NotFoundException('Membership not found');

      const currency = await manager.findOne(OrganizationCurrency, {
        where: { id: membership.currencyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currency) throw new NotFoundException('Currency not found');

      membership.balance = Number(membership.balance) + dto.amount;
      currency.circulatingSupply = Number(currency.circulatingSupply) + dto.amount;

      await manager.save(OrganizationCurrency, currency);
      return manager.save(OrganizationMembership, membership);
    });
  }
}
