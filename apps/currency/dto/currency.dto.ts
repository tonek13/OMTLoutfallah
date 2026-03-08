import {
  IsString, IsOptional, IsNumber, IsHexColor,
  IsPositive, MinLength, MaxLength, Min, IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
