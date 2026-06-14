import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToConversations1782600000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE conversations DROP COLUMN IF EXISTS deleted_at`);
  }
}
