import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCurrencyEntity1773014400000 implements MigrationInterface {
  public readonly name = 'CreateCurrencyEntity1773014400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCurrencies = await queryRunner.hasTable('currencies');
    const hasLegacyCurrencies = await queryRunner.hasTable('organization_currencies');

    if (!hasCurrencies && hasLegacyCurrencies) {
      await queryRunner.renameTable('organization_currencies', 'currencies');

      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'organization_currencies_status_enum'
          ) AND NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'currencies_status_enum'
          ) THEN
            ALTER TYPE "organization_currencies_status_enum" RENAME TO "currencies_status_enum";
          END IF;
        END
        $$;
      `);
    }

    if (!(await queryRunner.hasTable('currencies'))) {
      await queryRunner.createTable(
        new Table({
          name: 'currencies',
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
            },
            {
              name: 'name',
              type: 'varchar',
              length: '120',
            },
            {
              name: 'symbol',
              type: 'varchar',
              length: '10',
            },
            {
              name: 'totalSupply',
              type: 'decimal',
              precision: 18,
              scale: 4,
              default: '0',
            },
            {
              name: 'circulatingSupply',
              type: 'decimal',
              precision: 18,
              scale: 4,
              default: '0',
            },
            {
              name: 'color',
              type: 'varchar',
              length: '7',
              isNullable: true,
            },
            {
              name: 'earnRules',
              type: 'jsonb',
              isNullable: true,
            },
            {
              name: 'status',
              type: 'enum',
              enumName: 'currencies_status_enum',
              enum: ['active', 'paused', 'archived'],
              default: "'active'",
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

    if (!(await queryRunner.hasColumn('currencies', 'earnRules'))) {
      await queryRunner.addColumn(
        'currencies',
        new TableColumn({
          name: 'earnRules',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }

    const currenciesTable = await queryRunner.getTable('currencies');
    if (!currenciesTable) {
      return;
    }

    if (!currenciesTable.indices.some((idx) => idx.name === 'IDX_currencies_tenantId')) {
      await queryRunner.createIndex(
        'currencies',
        new TableIndex({
          name: 'IDX_currencies_tenantId',
          columnNames: ['tenantId'],
        }),
      );
    }

    if (!currenciesTable.indices.some((idx) => idx.name === 'IDX_currencies_symbol')) {
      await queryRunner.createIndex(
        'currencies',
        new TableIndex({
          name: 'IDX_currencies_symbol',
          columnNames: ['symbol'],
        }),
      );
    }

    const refreshedCurrenciesTable = await queryRunner.getTable('currencies');
    if (
      refreshedCurrenciesTable &&
      !refreshedCurrenciesTable.foreignKeys.some(
        (fk) => fk.columnNames.includes('tenantId') && fk.referencedTableName === 'tenants',
      )
    ) {
      await queryRunner.createForeignKey(
        'currencies',
        new TableForeignKey({
          name: 'FK_currencies_tenantId_tenants_id',
          columnNames: ['tenantId'],
          referencedTableName: 'tenants',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('currencies'))) {
      return;
    }

    const currenciesTable = await queryRunner.getTable('currencies');
    if (currenciesTable) {
      const tenantFk = currenciesTable.foreignKeys.find(
        (fk) => fk.name === 'FK_currencies_tenantId_tenants_id',
      );
      if (tenantFk) {
        await queryRunner.dropForeignKey('currencies', tenantFk);
      }

      const tenantIndex = currenciesTable.indices.find(
        (idx) => idx.name === 'IDX_currencies_tenantId',
      );
      if (tenantIndex) {
        await queryRunner.dropIndex('currencies', tenantIndex);
      }

      const symbolIndex = currenciesTable.indices.find(
        (idx) => idx.name === 'IDX_currencies_symbol',
      );
      if (symbolIndex) {
        await queryRunner.dropIndex('currencies', symbolIndex);
      }
    }

    if (await queryRunner.hasColumn('currencies', 'earnRules')) {
      await queryRunner.dropColumn('currencies', 'earnRules');
    }

    const hasLegacyTable = await queryRunner.hasTable('organization_currencies');
    if (!hasLegacyTable) {
      await queryRunner.renameTable('currencies', 'organization_currencies');
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'currencies_status_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'organization_currencies_status_enum'
        ) THEN
          ALTER TYPE "currencies_status_enum" RENAME TO "organization_currencies_status_enum";
        END IF;
      END
      $$;
    `);
  }
}
