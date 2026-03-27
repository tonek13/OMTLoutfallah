import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto, ResendOtpDto } from './dto/verify-email.dto';
import {
  AuthTokensResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
} from './dto/auth-response.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../libs/common/src/types/jwt-payload.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User created and verification email sent',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or email missing' })
  @ApiConflictResponse({ description: 'Phone or email already registered' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.ip);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiOkResponse({
    description: 'Email verification status',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email OTP code' })
  @ApiBody({ type: ResendOtpDto })
  @ApiOkResponse({
    description: 'OTP resend status',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Email not found or already verified' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with phone + password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Authenticated session tokens',
    type: AuthTokensResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiForbiddenResponse({
    description: 'Email not verified, user blocked, or account temporarily locked',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'New access and refresh tokens',
    type: AuthTokensResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    let payload: Partial<JwtPayload>;

    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    return this.authService.refreshTokens(payload.sub, dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout' })
  @ApiOkResponse({ description: 'Logout status', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user?.id);
  }
}
