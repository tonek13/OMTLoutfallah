import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import * as Joi from 'joi';
import { Transfer } from './entities/transfer.entity';
import { TransferService } from './transfer/transfer.service';
import { TransferController } from './transfer/transfer.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantContextInterceptor } from './tenant/tenant-context.interceptor';
import { TypeOrmTenantScopeInitializer } from './tenant/typeorm-tenant-scope.initializer';

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/transfer-service/.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().integer().min(1).max(65535).default(3002),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().optional(),
        DB_PASS: Joi.string().optional(),
        DB_NAME: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
        KAFKA_BROKERS: Joi.string().required(),
        ALLOWED_ORIGINS: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        ENABLE_SWAGGER: Joi.string().valid('true', 'false', '1', '0').default('false'),
        TYPEORM_SYNCHRONIZE: Joi.string().valid('true', 'false', '1', '0').default('false'),
        TYPEORM_LOGGING: Joi.string().valid('true', 'false', '1', '0').default('false'),
      }).or('DB_PASSWORD', 'DB_PASS'),
      validationOptions: {
        allowUnknown: true,
      },
    }),
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.getOrThrow<string>('DB_USER'),
        password:
          config.get<string>('DB_PASSWORD') ??
          config.getOrThrow<string>('DB_PASS'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [Transfer],
        synchronize: parseBoolean(config.get<string>('TYPEORM_SYNCHRONIZE'), false),
        logging: parseBoolean(config.get<string>('TYPEORM_LOGGING'), false),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Transfer]),
  ],
  controllers: [TransferController],
  providers: [
    TransferService,
    JwtStrategy,
    TypeOrmTenantScopeInitializer,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class TransferModule {}
