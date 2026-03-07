import { resolve4 } from 'dns/promises';
import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Redis from 'ioredis';

@Injectable()
export class EmailOtpService implements OnModuleInit {
    private readonly logger = new Logger(EmailOtpService.name);
    private transporter?: nodemailer.Transporter;
    private redis: Redis;
    private readonly smtpHost = 'smtp.gmail.com';
    private smtpCandidates: string[] = [];
    private gmailUser?: string;
    private gmailPassword?: string;

    constructor(private config: ConfigService) {
        this.gmailUser = this.config.get<string>('GMAIL_USER');
        this.gmailPassword = this.config.get<string>('GMAIL_APP_PASSWORD');

        this.redis = new Redis({
            host: this.config.get('REDIS_HOST') || 'localhost',
            port: this.config.get<number>('REDIS_PORT') || 6379,
        });
    }

    async onModuleInit(): Promise<void> {
        if (!this.gmailUser || !this.gmailPassword) {
            this.logger.warn(
                'Email OTP transport is disabled because GMAIL_USER or GMAIL_APP_PASSWORD is missing.',
            );
            return;
        }

        await this.loadSmtpCandidates();
        this.buildTransport(this.smtpCandidates[0]);

        try {
            await this.transporter?.verify();
            this.logger.log(`Email OTP transport is ready using ${this.smtpCandidates[0]}.`);
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            this.logger.error(`Email OTP transport verification failed: ${reason}`);
        }
    }

    async sendOtp(email: string): Promise<void> {
        if (!this.gmailUser || !this.gmailPassword) {
            throw new InternalServerErrorException('Email service is not configured.');
        }

        if (!this.transporter) {
            await this.loadSmtpCandidates();
            this.buildTransport(this.smtpCandidates[0]);
        }

        const otp = this.generateOtp();
        const key = `otp:email:${email}`;

        await this.redis.setex(key, 600, otp);

        try {
            await this.sendWithFailover(email, otp);
            this.logger.log(`OTP sent to ${email}`);
        } catch (err) {
            await this.redis.del(key);
            const reason = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to send OTP to ${email}: ${reason}`);
            throw new InternalServerErrorException('Failed to send verification email.');
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

    private async sendWithFailover(email: string, otp: string): Promise<void> {
        const errors: string[] = [];

        for (const candidate of this.smtpCandidates) {
            this.buildTransport(candidate);

            try {
                await this.transporter?.sendMail({
                    from: `"OMT Lebanon" <${this.gmailUser}>`,
                    to: email,
                    subject: 'Your OMT Verification Code',
                    html: this.emailTemplate(otp),
                });
                return;
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                this.logger.warn(`SMTP send via ${candidate} failed: ${reason}`);
                errors.push(`${candidate}: ${reason}`);
            }
        }

        throw new Error(errors.join(' | '));
    }

    private async loadSmtpCandidates(): Promise<void> {
        try {
            const ipv4Hosts = await resolve4(this.smtpHost);
            this.smtpCandidates = [...new Set(ipv4Hosts)];
            if (this.smtpCandidates.length > 0) {
                this.logger.log(
                    `Resolved ${this.smtpHost} to IPv4: ${this.smtpCandidates.join(', ')}`,
                );
            }
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Failed to resolve IPv4 for ${this.smtpHost}: ${reason}`);
        }

        if (this.smtpCandidates.length === 0) {
            this.smtpCandidates = [this.smtpHost];
        }
    }

    private buildTransport(host: string): void {
        this.transporter = nodemailer.createTransport({
            host,
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: this.gmailUser,
                pass: this.gmailPassword,
            },
            tls: {
                servername: this.smtpHost,
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
        });
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
