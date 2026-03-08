import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddTenantFkToUserAndTransfer202603080001
  implements MigrationInterface
{
  public readonly name = 'AddTenantFkToUserAndTransfer202603080001';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      !usersTableWithIndex.foreignKeys.some((fk) => fk.name === 'FK_users_tenantId_tenants_id')
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
