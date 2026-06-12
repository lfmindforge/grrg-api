import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSettings1782300000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE user_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value JSONB NOT NULL DEFAULT 'true',
        CONSTRAINT uq_user_setting UNIQUE (user_id, key)
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE user_settings`);
  }
}
