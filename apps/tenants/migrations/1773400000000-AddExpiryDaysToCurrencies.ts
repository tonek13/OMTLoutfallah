import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExpiryDaysToCurrencies1773400000000 implements MigrationInterface {
  public readonly name = 'AddExpiryDaysToCurrencies1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('currencies')) {
      const hasExpiryDays = await queryRunner.hasColumn('currencies', 'expiryDays');
      if (!hasExpiryDays) {
        await queryRunner.addColumn(
          'currencies',
          new TableColumn({
            name: 'expiryDays',
            type: 'int',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('currencies')) {
      const hasExpiryDays = await queryRunner.hasColumn('currencies', 'expiryDays');
      if (hasExpiryDays) {
        await queryRunner.dropColumn('currencies', 'expiryDays');
      }
    }
  }
}
