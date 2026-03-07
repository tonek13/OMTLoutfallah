import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '482910' })
    @IsString()
    @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
    otp: string;
}

export class ResendOtpDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;
}