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
