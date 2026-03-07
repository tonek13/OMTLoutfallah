import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '+9613123456' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}
