import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'acme' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^(?!-)[a-z0-9-]+(?<!-)$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: '+9613123456' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'adminPhone must be a valid international number',
  })
  adminPhone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'adminPassword must contain uppercase, lowercase, number, and special character',
  })
  adminPassword!: string;
}

export class TenantSummaryResponseDto {
  @ApiProperty({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  id!: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name!: string;

  @ApiProperty({ example: 'acme' })
  slug!: string;

  @ApiProperty({ example: 'https://cdn.example.com/logo.png', nullable: true })
  logo!: string | null;

  @ApiProperty({ example: '#1f6feb', nullable: true })
  primaryColor!: string | null;

  @ApiProperty({ example: 'starter' })
  plan!: string;

  @ApiProperty({ example: 'trial' })
  status!: string;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  createdAt!: Date;
}

export class TenantAdminSummaryResponseDto {
  @ApiProperty({ example: 'e6b02018-c8ca-4f79-9842-d8efed1c4891' })
  id!: string;

  @ApiProperty({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  tenantId!: string;

  @ApiProperty({ example: 'admin@acme.com' })
  email!: string;

  @ApiProperty({ example: '+9613123456' })
  phone!: string;

  @ApiProperty({ example: 'tenant_admin' })
  role!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;

  @ApiProperty({ example: false })
  emailVerified!: boolean;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  createdAt!: Date;
}

export class TokenSetResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class CreateTenantResponseDto {
  @ApiProperty({ type: TenantSummaryResponseDto })
  tenant!: TenantSummaryResponseDto;

  @ApiProperty({ type: TenantAdminSummaryResponseDto })
  admin!: TenantAdminSummaryResponseDto;

  @ApiProperty({ type: TokenSetResponseDto })
  tokens!: TokenSetResponseDto;
}
