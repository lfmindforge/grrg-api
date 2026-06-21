import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToEntities1781800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['users', 'wishes', 'donations', 'evaluations', 'comments', 'badges'];
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tables = ['users', 'wishes', 'donations', 'evaluations', 'comments', 'badges'];
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at"`);
    }
  }
}
