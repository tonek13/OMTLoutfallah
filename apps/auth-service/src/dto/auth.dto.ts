import {
  IsString, IsPhoneNumber, IsEmail,
  MinLength, IsOptional, IsNotEmpty, Matches
} from 'class-validator';

export class RegisterDto {
  @IsPhoneNumber('LB')  // Lebanese phone validation
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password too weak — needs uppercase, lowercase, and number',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  nationalId?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  twoFaCode?: string;  // if 2FA enabled
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class Enable2FADto {
  @IsString()
  @IsNotEmpty()
  code: string; // verify code before enabling
}
