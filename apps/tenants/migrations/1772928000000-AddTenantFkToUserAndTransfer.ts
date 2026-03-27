import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
  Table,
} from 'typeorm';

export class AddTenantFkToUserAndTransfer1772928000000
  implements MigrationInterface
{
  public readonly name = 'AddTenantFkToUserAndTransfer1772928000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tenants'))) {
      await queryRunner.createTable(
        new Table({
          name: 'tenants',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'varchar',
              length: '120',
            },
            {
              name: 'slug',
              type: 'varchar',
              length: '60',
              isUnique: true,
            },
            {
              name: 'logo',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'primaryColor',
              type: 'varchar',
              length: '7',
              isNullable: true,
            },
            {
              name: 'plan',
              type: 'varchar',
              default: "'starter'",
            },
            {
              name: 'status',
              type: 'varchar',
              default: "'trial'",
            },
            {
              name: 'ownerUserId',
              type: 'uuid',
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

    if (await queryRunner.hasTable('users')) {
      if (!(await queryRunner.hasColumn('users', 'tenantId'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({
            name: 'tenantId',
            type: 'uuid',
            isNullable: true,
          }),
        );
      }

      const usersTable = await queryRunner.getTable('users');
      if (usersTable && !usersTable.indices.some((idx) => idx.name === 'IDX_users_tenantId')) {
        await queryRunner.createIndex(
          'users',
          new TableIndex({
            name: 'IDX_users_tenantId',
            columnNames: ['tenantId'],
          }),
        );
      }

      const usersTableWithIndex = await queryRunner.getTable('users');
      if (
        usersTableWithIndex &&
        !usersTableWithIndex.foreignKeys.some(
          (fk) => fk.name === 'FK_users_tenantId_tenants_id',
        )
      ) {
        await queryRunner.createForeignKey(
          'users',
          new TableForeignKey({
            name: 'FK_users_tenantId_tenants_id',
            columnNames: ['tenantId'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          }),
        );
      }
    }

    if (await queryRunner.hasTable('transfers')) {
      if (!(await queryRunner.hasColumn('transfers', 'tenantId'))) {
        await queryRunner.addColumn(
          'transfers',
          new TableColumn({
            name: 'tenantId',
            type: 'uuid',
            isNullable: true,
          }),
        );
      }

      const transfersTable = await queryRunner.getTable('transfers');
      if (
        transfersTable &&
        !transfersTable.indices.some((idx) => idx.name === 'IDX_transfers_tenantId')
      ) {
        await queryRunner.createIndex(
          'transfers',
          new TableIndex({
            name: 'IDX_transfers_tenantId',
            columnNames: ['tenantId'],
          }),
        );
      }

      const transfersTableWithIndex = await queryRunner.getTable('transfers');
      if (
        transfersTableWithIndex &&
        !transfersTableWithIndex.foreignKeys.some(
          (fk) => fk.name === 'FK_transfers_tenantId_tenants_id',
        )
      ) {
        await queryRunner.createForeignKey(
          'transfers',
          new TableForeignKey({
            name: 'FK_transfers_tenantId_tenants_id',
            columnNames: ['tenantId'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    const usersFk = usersTable?.foreignKeys.find(
      (fk) => fk.name === 'FK_users_tenantId_tenants_id',
    );
    if (usersFk) {
      await queryRunner.dropForeignKey('users', usersFk);
    }

    const usersIndex = usersTable?.indices.find((idx) => idx.name === 'IDX_users_tenantId');
    if (usersIndex) {
      await queryRunner.dropIndex('users', usersIndex);
    }

    if (await queryRunner.hasColumn('users', 'tenantId')) {
      await queryRunner.dropColumn('users', 'tenantId');
    }

    const transfersTable = await queryRunner.getTable('transfers');
    const transfersFk = transfersTable?.foreignKeys.find(
      (fk) => fk.name === 'FK_transfers_tenantId_tenants_id',
    );
    if (transfersFk) {
      await queryRunner.dropForeignKey('transfers', transfersFk);
    }

    const transfersIndex = transfersTable?.indices.find(
      (idx) => idx.name === 'IDX_transfers_tenantId',
    );
    if (transfersIndex) {
      await queryRunner.dropIndex('transfers', transfersIndex);
    }

    if (await queryRunner.hasColumn('transfers', 'tenantId')) {
      await queryRunner.dropColumn('transfers', 'tenantId');
    }
  }
}
