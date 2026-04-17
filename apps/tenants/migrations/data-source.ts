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

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const AppDataSource = new DataSource({
  type: 'postgres',
  host: getRequiredEnv('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 5432),
  username: getRequiredEnv('DB_USER'),
  password: process.env.DB_PASSWORD ?? getRequiredEnv('DB_PASS'),
  database: getRequiredEnv('DB_NAME'),
  entities: [User, Transfer, Tenant, Currency, Wallet, AuditLog],
  migrations: [__dirname + '/[0-9]*-*.ts', __dirname + '/[0-9]*-*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: parseBoolean(process.env.TYPEORM_LOGGING, false),
});

export default AppDataSource;
