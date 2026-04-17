import {
  IsString, IsOptional, IsNumber, IsHexColor,
  IsPositive, MinLength, MaxLength, Min, IsInt, ValidateIf, IsEnum, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { CurrencyStatus } from '../entities/currency.entity';
import { TenantPlan, TenantStatus } from '../../auth-service/src/modules/tenants/tenant.entity';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'American University of Beirut' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'aub' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  slug!: string;

  @ApiPropertyOptional({ example: '#c9a84c' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logo?: string;
}

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ example: 'American University of Beirut' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logo?: string;

  @ApiPropertyOptional({ example: '#c9a84c' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;
}

export class CreateOrganizationCurrencyDto {
  @ApiProperty({ example: 'Campus Coin' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ACC' })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  symbol!: string;

  @ApiProperty({ example: 1000000 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  initialSupply!: number;

  @ApiPropertyOptional({ example: '#4caf50' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ description: 'Days before earned tokens expire. Null = never.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  expiryDays?: number;

  @ApiPropertyOptional({ description: 'JSON earn rules definition' })
  @IsOptional()
  earnRules?: Record<string, any>;
}

export class AddOrganizationMemberDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsString()
  userId!: string;
}

export class AssignCurrencyDto {
  @ApiProperty({ example: 'uuid-of-currency' })
  @IsString()
  currencyId!: string;

  @ApiProperty({ example: 'uuid-of-user' })
  @IsString()
  userId!: string;
}

export class MintTokensDto {
  @ApiProperty({ example: 'uuid-of-membership' })
  @IsString()
  membershipId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ example: 'Reward for top attendance' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MintCurrencyToRecipientDto {
  @ApiProperty({ example: 'uuid-of-recipient-user' })
  @IsString()
  recipientId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ example: 'Reward for top attendance' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BurnCurrencyDto {
  @ApiProperty({ example: 250 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ example: 'Expired rewards cleanup' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateCurrencyDto {
  @ApiPropertyOptional({ example: 'Campus Coin Plus' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '#4caf50' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ description: 'JSON earn rules definition' })
  @IsOptional()
  earnRules?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 30, description: 'Days before earned tokens expire. Null = never.' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    return Number(value);
  })
  @ValidateIf((_obj, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  expiryDays?: number | null;

  @ApiPropertyOptional({
    example: 'ACC',
    description: 'Can only be changed before the first wallet exists for this currency',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  symbol?: string;
}

export enum CurrencyTransactionType {
  MINT = 'mint',
  BURN = 'burn',
  TRANSFER = 'transfer',
}

export class CurrencyTransactionsQueryDto {
  @ApiPropertyOptional({
    enum: CurrencyTransactionType,
    description: 'Filter by transaction type',
  })
  @IsOptional()
  @IsEnum(CurrencyTransactionType)
  type?: CurrencyTransactionType;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CurrencyTransactionActorDto {
  @ApiProperty({ example: 'e6b02018-c8ca-4f79-9842-d8efed1c4891' })
  id!: string;

  @ApiPropertyOptional({ example: '+9613123456' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'admin@acme.com' })
  email?: string | null;
}

export class CurrencyTransactionResponseDto {
  @ApiProperty({ example: 'fb6ba9bd-d2f7-42a3-a623-9302c9c317ff' })
  id!: string;

  @ApiProperty({ enum: CurrencyTransactionType, example: CurrencyTransactionType.MINT })
  type!: CurrencyTransactionType;

  @ApiProperty({ type: CurrencyTransactionActorDto })
  actor!: CurrencyTransactionActorDto;

  @ApiProperty({ example: 125.5 })
  amount!: number;

  @ApiPropertyOptional({ example: 'Monthly reward distribution' })
  reason?: string | null;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  timestamp!: Date;
}

export class CurrencyTransactionsMetaDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  pages!: number;
}

export class CurrencyTransactionsResponseDto {
  @ApiProperty({ type: CurrencyTransactionResponseDto, isArray: true })
  data!: CurrencyTransactionResponseDto[];

  @ApiProperty({ type: CurrencyTransactionsMetaDto })
  meta!: CurrencyTransactionsMetaDto;
}

export class CurrencyDailyVolumePointDto {
  @ApiProperty({ example: '2026-04-17' })
  date!: string;

  @ApiProperty({ example: 1520.75 })
  volume!: number;
}

export class CurrencyPanelStatsResponseDto {
  @ApiProperty({ example: 12000 })
  totalMinted!: number;

  @ApiProperty({ example: 1500 })
  totalBurned!: number;

  @ApiProperty({ example: 842 })
  totalTransfers!: number;

  @ApiProperty({ example: 214 })
  activeWallets!: number;

  @ApiProperty({ type: CurrencyDailyVolumePointDto, isArray: true })
  dailyVolume!: CurrencyDailyVolumePointDto[];
}

export class TenantResponseDto {
  @ApiProperty({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  id!: string;

  @ApiProperty({ example: 'American University of Beirut' })
  name!: string;

  @ApiProperty({ example: 'aub' })
  slug!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  logo?: string;

  @ApiPropertyOptional({ example: '#c9a84c' })
  primaryColor?: string;

  @ApiProperty({ enum: TenantPlan, example: TenantPlan.STARTER })
  plan!: TenantPlan;

  @ApiProperty({ enum: TenantStatus, example: TenantStatus.TRIAL })
  status!: TenantStatus;

  @ApiProperty({ example: 'b9ff68bd-b514-42cb-8a59-dab1f7944c35' })
  ownerUserId!: string;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CurrencyResponseDto {
  @ApiProperty({ example: '6e1084f0-42bd-430b-b53b-8f7f9665179d' })
  id!: string;

  @ApiProperty({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  tenantId!: string;

  @ApiProperty({ example: 'Campus Coin' })
  name!: string;

  @ApiProperty({ example: 'ACC' })
  symbol!: string;

  @ApiProperty({ example: 1000000 })
  totalSupply!: number;

  @ApiProperty({ example: 1000000 })
  circulatingSupply!: number;

  @ApiPropertyOptional({ example: '#4caf50' })
  color?: string;

  @ApiPropertyOptional({
    example: { activityType: 'attendance', basePoints: 10 },
    additionalProperties: true,
  })
  earnRules?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 30, description: 'Token expiry duration in days' })
  expiryDays?: number;

  @ApiProperty({ enum: CurrencyStatus, example: CurrencyStatus.ACTIVE })
  status!: CurrencyStatus;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CurrencyStatsResponseDto {
  @ApiProperty({ example: 'Campus Coin' })
  name!: string;

  @ApiProperty({ example: 'ACC' })
  symbol!: string;

  @ApiProperty({ example: 875000 })
  circulatingSupply!: number;

  @ApiProperty({ example: 214 })
  totalWallets!: number;

  @ApiProperty({ example: 5096 })
  totalTransfers!: number;
}

export class WalletCurrencySummaryDto {
  @ApiProperty({ example: '6e1084f0-42bd-430b-b53b-8f7f9665179d' })
  id!: string;

  @ApiProperty({ example: 'Campus Coin' })
  name!: string;

  @ApiProperty({ example: 'ACC' })
  symbol!: string;

  @ApiPropertyOptional({ example: '#4caf50' })
  color?: string;

  @ApiProperty({ enum: CurrencyStatus, example: CurrencyStatus.ACTIVE })
  status!: CurrencyStatus;
}

export class WalletResponseDto {
  @ApiProperty({ example: '1f4af5d9-80d8-4f49-9af4-7bcb8f77f8b4' })
  id!: string;

  @ApiProperty({ example: 'a97a99df-519f-4af8-a177-bf58be7ab094' })
  userId!: string;

  @ApiProperty({ example: '6e1084f0-42bd-430b-b53b-8f7f9665179d' })
  currencyId!: string;

  @ApiProperty({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  tenantId!: string;

  @ApiProperty({ example: 250 })
  balance!: number;

  @ApiProperty({ example: 0 })
  frozenBalance!: number;

  @ApiPropertyOptional({ type: WalletCurrencySummaryDto })
  currency?: WalletCurrencySummaryDto;
}
