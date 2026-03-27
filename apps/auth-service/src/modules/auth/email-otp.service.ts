import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class EmailOtpService implements OnModuleInit {
  private readonly logger = new Logger(EmailOtpService.name);
  private redis: Redis;
  private brevoApiKey: string;
  private fromEmail: string;
  private fromName: string;
  private readonly isProduction: boolean;

  constructor(private config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST') || 'localhost',
      port: this.config.get<number>('REDIS_PORT') || 6379,
    });
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY') || '';
    this.fromEmail = this.config.get<string>('BREVO_FROM_EMAIL') || '';
    this.fromName = this.config.get<string>('BREVO_FROM_NAME') || 'OMT Lebanon';
  }

  async onModuleInit(): Promise<void> {
    if (this.brevoApiKey) {
      this.logger.log('Email OTP provider: Brevo API');
    } else {
      this.logger.warn('Email OTP transport is disabled — no email provider configured.');
    }
  }

  async sendOtp(email: string): Promise<void> {
    return this.sendOtpEmail({
      email,
      subject: 'Your OMT Verification Code',
      heading: 'Verify your email',
      intro: 'Enter this code to verify your account:',
    });
  }

  async sendWelcomeOtp(email: string, tenantName: string): Promise<void> {
    return this.sendOtpEmail({
      email,
      subject: `Welcome to OMT - ${tenantName}`,
      heading: `Welcome to ${tenantName}`,
      intro:
        'Your admin account is ready. Use this OTP to verify your email and activate your organization:',
    });
  }

  private async sendOtpEmail(params: {
    email: string;
    subject: string;
    heading: string;
    intro: string;
  }): Promise<void> {
    const otp = this.generateOtp();
    const key = `otp:email:${params.email}`;
    await this.redis.setex(key, 600, otp);

    if (!this.brevoApiKey) {
      if (this.isProduction) {
        await this.redis.del(key);
        throw new InternalServerErrorException('Email service is not configured.');
      }

      this.logger.warn(
        `Email transport disabled in non-production. OTP for ${params.email}: ${otp}`,
      );
      return;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: params.email }],
          subject: params.subject,
          htmlContent: this.emailTemplate({
            otp,
            heading: params.heading,
            intro: params.intro,
          }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API ${response.status}: ${errorText}`);
      }

      this.logger.log(`OTP sent to ${params.email}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send OTP to ${params.email}: ${reason}`);

      if (this.isProduction) {
        await this.redis.del(key);
        throw new InternalServerErrorException('Failed to send verification email.');
      }

      this.logger.warn(
        `Using fallback OTP in non-production for ${params.email}: ${otp}`,
      );
    }
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const key = `otp:email:${email}`;
    const stored = await this.redis.get(key);
    if (!stored || stored !== code) return false;
    await this.redis.del(key);
    return true;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private emailTemplate(params: { otp: string; heading: string; intro: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #ffb900; color: #000; font-weight: bold; font-size: 20px; padding: 10px 20px; border-radius: 8px;">OMT</div>
        </div>
        <h2 style="color: #1a1a2e; text-align: center; margin-bottom: 8px;">${params.heading}</h2>
        <p style="color: #666; text-align: center; margin-bottom: 32px;">${params.intro}</p>
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="display: inline-block; background: #fff; border: 2px solid #ffb900; border-radius: 12px; padding: 16px 40px; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #1a1a2e;">${params.otp}</span>
        </div>
        <p style="color: #999; text-align: center; font-size: 13px;">Expires in <strong>10 minutes</strong>. Do not share it.</p>
      </div>
    `;
  }
}
