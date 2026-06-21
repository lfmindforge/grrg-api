import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCountToBadges1781600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE badges ADD COLUMN count INTEGER NOT NULL DEFAULT 1`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE badges DROP COLUMN count`);
  }
}
