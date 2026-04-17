import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../../auth-service/src/modules/users/user.entity';
import { Tenant } from '../../auth-service/src/modules/tenants/tenant.entity';
import { Currency } from '../../currency/entities/currency.entity';
import { Wallet } from '../../currency/entities/wallet.entity';
import { AuditLog } from '../../currency/entities/audit-log.entity';
import { Transfer } from '../../transfer-service/src/entities/transfer.entity';

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const resolveDbSsl = (): false | { rejectUnauthorized: boolean } => {
  const sslMode = process.env.PGSSLMODE?.toLowerCase();
  if (sslMode === 'disable') return false;
  if (sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full') {
    return {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }

  const explicitSsl = process.env.DB_SSL ?? process.env.TYPEORM_SSL;
  if (explicitSsl !== undefined) {
    if (parseBoolean(explicitSsl, false)) {
      return {
        rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
      };
    }
    return false;
  }

  const usesNeon =
    (process.env.DATABASE_URL ?? '').includes('neon.tech')
    || (process.env.DB_HOST ?? '').includes('neon.tech');

  if (usesNeon || process.env.NODE_ENV === 'production') {
    return {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }

  return false;
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const databaseUrl = process.env.DATABASE_URL?.trim();

const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
      url: databaseUrl,
    }
    : {
      host: getRequiredEnv('DB_HOST'),
      port: Number(process.env.DB_PORT ?? 5432),
      username: getRequiredEnv('DB_USER'),
      password: process.env.DB_PASSWORD ?? getRequiredEnv('DB_PASS'),
      database: getRequiredEnv('DB_NAME'),
    }),
  ssl: resolveDbSsl(),
  entities: [User, Transfer, Tenant, Currency, Wallet, AuditLog],
  migrations: [__dirname + '/[0-9]*-*.ts', __dirname + '/[0-9]*-*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: parseBoolean(process.env.TYPEORM_LOGGING, false),
});

export default AppDataSource;
