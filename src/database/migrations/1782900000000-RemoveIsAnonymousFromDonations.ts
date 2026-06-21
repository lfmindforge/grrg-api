import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveIsAnonymousFromDonations1782900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN IF EXISTS "is_anonymous"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "donations" ADD COLUMN "is_anonymous" boolean NOT NULL DEFAULT false`);
  }
}
