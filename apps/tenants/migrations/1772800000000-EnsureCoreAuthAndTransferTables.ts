import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class EnsureCoreAuthAndTransferTables1772800000000
  implements MigrationInterface
{
  public readonly name = 'EnsureCoreAuthAndTransferTables1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await this.ensureUserEnumTypes(queryRunner);
    await this.ensureTransferEnumTypes(queryRunner);

    if (!(await queryRunner.hasTable('users'))) {
      await queryRunner.createTable(
        new Table({
          name: 'users',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'tenantId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'phone',
              type: 'varchar',
            },
            {
              name: 'email',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'passwordHash',
              type: 'varchar',
            },
            {
              name: 'role',
              type: 'enum',
              enumName: 'users_role_enum',
              enum: ['customer', 'agent', 'admin', 'superadmin', 'tenant_admin'],
              default: "'customer'",
            },
            {
              name: 'status',
              type: 'enum',
              enumName: 'users_status_enum',
              enum: ['pending', 'active', 'suspended', 'blocked'],
              default: "'pending'",
            },
            {
              name: 'phoneVerified',
              type: 'boolean',
              default: false,
            },
            {
              name: 'twoFactorEnabled',
              type: 'boolean',
              default: false,
            },
            {
              name: 'twoFactorSecret',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'refreshTokenHash',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'failedLoginAttempts',
              type: 'integer',
              default: 0,
            },
            {
              name: 'lockedUntil',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'lastLoginAt',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'lastLoginIp',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'emailVerified',
              type: 'boolean',
              default: false,
            },
          ],
        }),
      );
    }

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_tenantId" ON "users" ("tenantId")');
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_phone_unique" ON "users" ("phone")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email")',
    );

    if (!(await queryRunner.hasTable('transfers'))) {
      await queryRunner.createTable(
        new Table({
          name: 'transfers',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'tenantId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'senderId',
              type: 'uuid',
            },
            {
              name: 'receiverPhone',
              type: 'varchar',
              length: '20',
            },
            {
              name: 'receiverName',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'amount',
              type: 'decimal',
              precision: 18,
              scale: 4,
            },
            {
              name: 'feeAmount',
              type: 'decimal',
              precision: 18,
              scale: 4,
              default: '0',
            },
            {
              name: 'totalAmount',
              type: 'decimal',
              precision: 18,
              scale: 4,
            },
            {
              name: 'currency',
              type: 'enum',
              enumName: 'transfers_currency_enum',
              enum: ['LBP', 'USD', 'EUR'],
            },
            {
              name: 'type',
              type: 'enum',
              enumName: 'transfers_type_enum',
              enum: ['DOMESTIC', 'INTERNATIONAL', 'WALLET'],
            },
            {
              name: 'status',
              type: 'enum',
              enumName: 'transfers_status_enum',
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED'],
              default: "'PENDING'",
            },
            {
              name: 'referenceCode',
              type: 'varchar',
              length: '20',
            },
            {
              name: 'note',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'senderIp',
              type: 'varchar',
              length: '45',
              isNullable: true,
            },
            {
              name: 'isFlagged',
              type: 'boolean',
              default: false,
            },
            {
              name: 'flagReason',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'cancelledBy',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'completedAt',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
      );
    }

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transfers_referenceCode_unique" ON "transfers" ("referenceCode")',
    );
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_transfers_senderId" ON "transfers" ("senderId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_transfers_tenantId" ON "transfers" ("tenantId")');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transfers_receiverPhone" ON "transfers" ("receiverPhone")',
    );
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_transfers_status" ON "transfers" ("status")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('transfers')) {
      await queryRunner.dropTable('transfers');
    }

    if (await queryRunner.hasTable('users')) {
      await queryRunner.dropTable('users');
    }
  }

  private async ensureUserEnumTypes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'users_role_enum'
        ) THEN
          CREATE TYPE "users_role_enum" AS ENUM ('customer', 'agent', 'admin', 'superadmin', 'tenant_admin');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'users_role_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          INNER JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'users_role_enum'
            AND e.enumlabel = 'tenant_admin'
        ) THEN
          ALTER TYPE "users_role_enum" ADD VALUE 'tenant_admin';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'users_status_enum'
        ) THEN
          CREATE TYPE "users_status_enum" AS ENUM ('pending', 'active', 'suspended', 'blocked');
        END IF;
      END
      $$;
    `);
  }

  private async ensureTransferEnumTypes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'transfers_currency_enum'
        ) THEN
          CREATE TYPE "transfers_currency_enum" AS ENUM ('LBP', 'USD', 'EUR');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'transfers_type_enum'
        ) THEN
          CREATE TYPE "transfers_type_enum" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'WALLET');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'transfers_status_enum'
        ) THEN
          CREATE TYPE "transfers_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED');
        END IF;
      END
      $$;
    `);
  }
}
