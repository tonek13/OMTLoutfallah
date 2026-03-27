import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateWalletEntity1773187200000 implements MigrationInterface {
  public readonly name = 'CreateWalletEntity1773187200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasWallets = await queryRunner.hasTable('wallets');
    const hasLegacyMemberships = await queryRunner.hasTable('organization_memberships');

    if (!hasWallets && hasLegacyMemberships) {
      await queryRunner.renameTable('organization_memberships', 'wallets');
    }

    if (!(await queryRunner.hasTable('wallets'))) {
      await queryRunner.createTable(
        new Table({
          name: 'wallets',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'userId',
              type: 'uuid',
            },
            {
              name: 'currencyId',
              type: 'uuid',
            },
            {
              name: 'tenantId',
              type: 'uuid',
            },
            {
              name: 'balance',
              type: 'decimal',
              precision: 18,
              scale: 4,
              default: '0',
            },
            {
              name: 'frozenBalance',
              type: 'decimal',
              precision: 18,
              scale: 4,
              default: '0',
            },
          ],
        }),
      );
    }

    if (!(await queryRunner.hasColumn('wallets', 'balance'))) {
      await queryRunner.addColumn(
        'wallets',
        new TableColumn({
          name: 'balance',
          type: 'decimal',
          precision: 18,
          scale: 4,
          default: '0',
        }),
      );
    }

    if (!(await queryRunner.hasColumn('wallets', 'frozenBalance'))) {
      await queryRunner.addColumn(
        'wallets',
        new TableColumn({
          name: 'frozenBalance',
          type: 'decimal',
          precision: 18,
          scale: 4,
          default: '0',
        }),
      );
    }

    const walletsTable = await queryRunner.getTable('wallets');
    if (!walletsTable) {
      return;
    }

    const hasUserCurrencyUnique =
      walletsTable.uniques.some(
        (unique) =>
          unique.columnNames.length === 2 &&
          unique.columnNames.includes('userId') &&
          unique.columnNames.includes('currencyId'),
      ) ||
      walletsTable.indices.some(
        (index) =>
          index.isUnique &&
          index.columnNames.length === 2 &&
          index.columnNames.includes('userId') &&
          index.columnNames.includes('currencyId'),
      );

    if (!hasUserCurrencyUnique) {
      await queryRunner.createUniqueConstraint(
        'wallets',
        new TableUnique({
          name: 'UQ_wallets_user_currency',
          columnNames: ['userId', 'currencyId'],
        }),
      );
    }

    if (!walletsTable.indices.some((idx) => idx.name === 'IDX_wallets_tenantId')) {
      await queryRunner.createIndex(
        'wallets',
        new TableIndex({
          name: 'IDX_wallets_tenantId',
          columnNames: ['tenantId'],
        }),
      );
    }

    if (!walletsTable.indices.some((idx) => idx.name === 'IDX_wallets_currencyId')) {
      await queryRunner.createIndex(
        'wallets',
        new TableIndex({
          name: 'IDX_wallets_currencyId',
          columnNames: ['currencyId'],
        }),
      );
    }

    const refreshedWalletsTable = await queryRunner.getTable('wallets');
    if (!refreshedWalletsTable) {
      return;
    }

    if (
      !refreshedWalletsTable.foreignKeys.some(
        (fk) => fk.columnNames.includes('tenantId') && fk.referencedTableName === 'tenants',
      )
    ) {
      await queryRunner.createForeignKey(
        'wallets',
        new TableForeignKey({
          name: 'FK_wallets_tenantId_tenants_id',
          columnNames: ['tenantId'],
          referencedTableName: 'tenants',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );
    }

    const currencyRefTable = (await queryRunner.hasTable('currencies'))
      ? 'currencies'
      : 'organization_currencies';

    if (
      !refreshedWalletsTable.foreignKeys.some(
        (fk) =>
          fk.columnNames.includes('currencyId') &&
          fk.referencedTableName === currencyRefTable,
      )
    ) {
      const legacyCurrencyFk = refreshedWalletsTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.includes('currencyId') &&
          fk.referencedTableName !== currencyRefTable,
      );
      if (legacyCurrencyFk) {
        await queryRunner.dropForeignKey('wallets', legacyCurrencyFk);
      }

      await queryRunner.createForeignKey(
        'wallets',
        new TableForeignKey({
          name: 'FK_wallets_currencyId_currencies_id',
          columnNames: ['currencyId'],
          referencedTableName: currencyRefTable,
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('wallets'))) {
      return;
    }

    const walletsTable = await queryRunner.getTable('wallets');
    if (walletsTable) {
      const tenantFk = walletsTable.foreignKeys.find(
        (fk) => fk.name === 'FK_wallets_tenantId_tenants_id',
      );
      if (tenantFk) {
        await queryRunner.dropForeignKey('wallets', tenantFk);
      }

      const currencyFk = walletsTable.foreignKeys.find(
        (fk) => fk.name === 'FK_wallets_currencyId_currencies_id',
      );
      if (currencyFk) {
        await queryRunner.dropForeignKey('wallets', currencyFk);
      }

      const tenantIndex = walletsTable.indices.find(
        (idx) => idx.name === 'IDX_wallets_tenantId',
      );
      if (tenantIndex) {
        await queryRunner.dropIndex('wallets', tenantIndex);
      }

      const currencyIndex = walletsTable.indices.find(
        (idx) => idx.name === 'IDX_wallets_currencyId',
      );
      if (currencyIndex) {
        await queryRunner.dropIndex('wallets', currencyIndex);
      }

      const walletUnique = walletsTable.uniques.find(
        (unique) => unique.name === 'UQ_wallets_user_currency',
      );
      if (walletUnique) {
        await queryRunner.dropUniqueConstraint('wallets', walletUnique);
      }
    }

    if (!(await queryRunner.hasTable('organization_memberships'))) {
      await queryRunner.renameTable('wallets', 'organization_memberships');
    }
  }
}
