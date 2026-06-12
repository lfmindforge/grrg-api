import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBannedUntilToUsers1782200000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE users ADD COLUMN banned_until TIMESTAMPTZ DEFAULT NULL;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE users DROP COLUMN banned_until;`);
  }
}
