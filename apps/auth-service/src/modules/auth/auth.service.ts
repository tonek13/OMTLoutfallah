import {
  Injectable, UnauthorizedException, ConflictException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserStatus } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto, ResendOtpDto } from './dto/verify-email.dto';
import { EmailOtpService } from './email-otp.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
      @InjectRepository(User)
      private readonly userRepo: Repository<User>,
      private readonly jwtService: JwtService,
      private readonly emailOtpService: EmailOtpService,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    const exists = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (exists) throw new ConflictException('Phone already registered');

    if (dto.email) {
      const emailExists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, passwordHash });
    await this.userRepo.save(user);

    if (dto.email) {
      await this.emailOtpService.sendOtp(dto.email);
      return {
        message: 'Registration successful. A verification code has been sent to your email.',
        emailVerificationRequired: true,
      };
    }

    return { message: 'Registration successful.' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('No account found with this email');
    if (user.emailVerified) return { message: 'Email already verified.' };

    const valid = await this.emailOtpService.verifyOtp(dto.email, dto.otp);
    if (!valid) throw new BadRequestException('Invalid or expired OTP code');

    await this.userRepo.update(user.id, {
      emailVerified: true,
      status: UserStatus.ACTIVE,
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('No account found with this email');
    if (user.emailVerified) return { message: 'Email already verified.' };

    await this.emailOtpService.sendOtp(dto.email);
    return { message: 'Verification code resent.' };
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(`Account locked. Try again after ${user.lockedUntil.toISOString()}`);
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException('Account has been blocked. Contact support.');
    }

    if (user.email && !user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null as any,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    return this.generateTokens(user);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException();

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, { refreshTokenHash: undefined as any });
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(user.id, { refreshTokenHash });

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900 };
  }

  private async handleFailedLogin(user: User) {
    const attempts = user.failedLoginAttempts + 1;
    const update: Partial<User> = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);
      update.lockedUntil = lockedUntil;
    }

    await this.userRepo.update(user.id, update);
  }
}