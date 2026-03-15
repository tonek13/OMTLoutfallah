import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { EmailOtpService } from '../auth/email-otp.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant, TenantPlan, TenantStatus } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailOtpService: EmailOtpService,
  ) {}

  async createTenant(dto: CreateTenantDto, ip?: string) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const adminPhone = dto.adminPhone.trim();

    const [tenantExists, phoneExists, emailExists] = await Promise.all([
      this.tenantRepo.findOne({ where: { slug } }),
      this.userRepo.findOne({ where: { phone: adminPhone } }),
      this.userRepo.findOne({ where: { email: adminEmail } }),
    ]);

    if (tenantExists) {
      throw new ConflictException('Tenant slug already taken');
    }
    if (phoneExists) {
      throw new ConflictException('Admin phone already registered');
    }
    if (emailExists) {
      throw new ConflictException('Admin email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
    const queryRunner = this.dataSource.createQueryRunner();

    let tenant: Tenant | null = null;
    let adminUser: User | null = null;

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existingTenant = await queryRunner.manager.findOne(Tenant, { where: { slug } });
      if (existingTenant) {
        throw new ConflictException('Tenant slug already taken');
      }

      adminUser = queryRunner.manager.create(User, {
        phone: adminPhone,
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.PENDING,
        emailVerified: false,
      });
      adminUser = await queryRunner.manager.save(User, adminUser);

      tenant = queryRunner.manager.create(Tenant, {
        name,
        slug,
        ownerUserId: adminUser.id,
        plan: TenantPlan.STARTER,
        status: TenantStatus.TRIAL,
      });
      tenant = await queryRunner.manager.save(Tenant, tenant);

      adminUser.tenantId = tenant.id;
      adminUser = await queryRunner.manager.save(User, adminUser);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (this.isUniqueViolation(error)) {
        throw this.mapUniqueViolation(error);
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.emailOtpService.sendWelcomeOtp(adminEmail, name);
    } catch (error) {
      if (adminUser?.id) {
        await this.userRepo.delete(adminUser.id);
      }
      if (tenant?.id) {
        await this.tenantRepo.delete(tenant.id);
      }
      throw error;
    }

    const tokens = await this.generateTokens(adminUser as User);
    return {
      tenant: this.serializeTenant(tenant as Tenant),
      admin: this.serializeAdmin(adminUser as User),
      tokens,
    };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(user.id, { refreshTokenHash });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  private serializeTenant(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo: tenant.logo,
      primaryColor: tenant.primaryColor,
      plan: tenant.plan,
      status: tenant.status,
      createdAt: tenant.createdAt,
    };
  }

  private serializeAdmin(user: User) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '23505';
  }

  private mapUniqueViolation(error: unknown): ConflictException {
    if (!(error instanceof QueryFailedError)) {
      return new ConflictException('Resource already exists');
    }

    const driverError = error.driverError as { detail?: string } | undefined;
    const detail = driverError?.detail?.toLowerCase() ?? '';

    if (detail.includes('(slug)')) {
      return new ConflictException('Tenant slug already taken');
    }
    if (detail.includes('(email)')) {
      return new ConflictException('Admin email already registered');
    }
    if (detail.includes('(phone)')) {
      return new ConflictException('Admin phone already registered');
    }

    return new ConflictException('Resource already exists');
  }
}
