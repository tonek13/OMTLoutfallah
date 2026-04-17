import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateAuditLogEntity1773350000000 implements MigrationInterface {
  public readonly name = 'CreateAuditLogEntity1773350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('audit_logs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'audit_logs',
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
              name: 'actorUserId',
              type: 'uuid',
            },
            {
              name: 'eventType',
              type: 'varchar',
              length: '100',
            },
            {
              name: 'entityType',
              type: 'varchar',
              length: '50',
            },
            {
              name: 'entityId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'payload',
              type: 'jsonb',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
      );
    }

    const auditLogsTable = await queryRunner.getTable('audit_logs');
    if (!auditLogsTable) {
      return;
    }

    if (!auditLogsTable.indices.some((idx) => idx.name === 'IDX_audit_logs_tenantId')) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_tenantId',
          columnNames: ['tenantId'],
        }),
      );
    }

    if (!auditLogsTable.indices.some((idx) => idx.name === 'IDX_audit_logs_actorUserId')) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_actorUserId',
          columnNames: ['actorUserId'],
        }),
      );
    }

    if (!auditLogsTable.indices.some((idx) => idx.name === 'IDX_audit_logs_eventType')) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_eventType',
          columnNames: ['eventType'],
        }),
      );
    }

    if (!auditLogsTable.indices.some((idx) => idx.name === 'IDX_audit_logs_createdAt')) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_createdAt',
          columnNames: ['createdAt'],
        }),
      );
    }

    const refreshedAuditLogsTable = await queryRunner.getTable('audit_logs');
    if (
      refreshedAuditLogsTable &&
      !refreshedAuditLogsTable.foreignKeys.some(
        (fk) => fk.columnNames.includes('tenantId') && fk.referencedTableName === 'tenants',
      )
    ) {
      await queryRunner.createForeignKey(
        'audit_logs',
        new TableForeignKey({
          name: 'FK_audit_logs_tenantId_tenants_id',
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
    if (!(await queryRunner.hasTable('audit_logs'))) {
      return;
    }

    const auditLogsTable = await queryRunner.getTable('audit_logs');
    if (auditLogsTable) {
      const tenantFk = auditLogsTable.foreignKeys.find(
        (fk) => fk.name === 'FK_audit_logs_tenantId_tenants_id',
      );
      if (tenantFk) {
        await queryRunner.dropForeignKey('audit_logs', tenantFk);
      }

      const tenantIndex = auditLogsTable.indices.find(
        (idx) => idx.name === 'IDX_audit_logs_tenantId',
      );
      if (tenantIndex) {
        await queryRunner.dropIndex('audit_logs', tenantIndex);
      }

      const actorIndex = auditLogsTable.indices.find(
        (idx) => idx.name === 'IDX_audit_logs_actorUserId',
      );
      if (actorIndex) {
        await queryRunner.dropIndex('audit_logs', actorIndex);
      }

      const eventTypeIndex = auditLogsTable.indices.find(
        (idx) => idx.name === 'IDX_audit_logs_eventType',
      );
      if (eventTypeIndex) {
        await queryRunner.dropIndex('audit_logs', eventTypeIndex);
      }

      const createdAtIndex = auditLogsTable.indices.find(
        (idx) => idx.name === 'IDX_audit_logs_createdAt',
      );
      if (createdAtIndex) {
        await queryRunner.dropIndex('audit_logs', createdAtIndex);
      }
    }

    await queryRunner.dropTable('audit_logs');
  }
}
