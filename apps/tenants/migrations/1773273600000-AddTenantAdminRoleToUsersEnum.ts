import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantAdminRoleToUsersEnum1773273600000
  implements MigrationInterface
{
  public readonly name = 'AddTenantAdminRoleToUsersEnum1773273600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'users_role_enum'
        ) THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            INNER JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'users_role_enum'
              AND e.enumlabel = 'tenant_admin'
          ) THEN
            ALTER TYPE "users_role_enum" ADD VALUE 'tenant_admin';
          END IF;
        END IF;
      END
      $$;
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL enums do not support DROP VALUE directly.
  }
}

