import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpiresAtToWishes1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."wishes_status_enum" ADD VALUE 'expired'`);
    await queryRunner.query(`ALTER TABLE "wishes" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wishes" DROP COLUMN "expires_at"`);
  }
}
