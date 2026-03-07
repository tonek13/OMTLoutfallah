import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Redis from 'ioredis';

@Injectable()
export class EmailOtpService {
    private readonly logger = new Logger(EmailOtpService.name);
    private transporter: nodemailer.Transporter;
    private redis: Redis;

    constructor(private config: ConfigService) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.config.get('GMAIL_USER'),
                pass: this.config.get('GMAIL_APP_PASSWORD'),
            },
        });

        this.redis = new Redis({
            host: this.config.get('REDIS_HOST') || 'localhost',
            port: this.config.get<number>('REDIS_PORT') || 6379,
        });
    }

    async sendOtp(email: string): Promise<void> {
        const otp = this.generateOtp();
        const key = `otp:email:${email}`;

        await this.redis.setex(key, 600, otp);

        try {
            await this.transporter.sendMail({
                from: `"OMT Lebanon" <${this.config.get('GMAIL_USER')}>`,
                to: email,
                subject: 'Your OMT Verification Code',
                html: this.emailTemplate(otp),
            });
            this.logger.log(`OTP sent to ${email}`);
        } catch (err) {
            this.logger.error(`Failed to send OTP to ${email}`, err);
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

    private emailTemplate(otp: string): string {
        return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #ffb900; color: #000; font-weight: bold; font-size: 20px; padding: 10px 20px; border-radius: 8px;">OMT</div>
        </div>
        <h2 style="color: #1a1a2e; text-align: center; margin-bottom: 8px;">Verify your email</h2>
        <p style="color: #666; text-align: center; margin-bottom: 32px;">Enter this code to verify your account:</p>
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="display: inline-block; background: #fff; border: 2px solid #ffb900; border-radius: 12px; padding: 16px 40px; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #1a1a2e;">${otp}</span>
        </div>
        <p style="color: #999; text-align: center; font-size: 13px;">Expires in <strong>10 minutes</strong>. Do not share it.</p>
      </div>
    `;
    }
}