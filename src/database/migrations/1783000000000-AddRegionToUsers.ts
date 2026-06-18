import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegionToUsers1783000000000 implements MigrationInterface {
  name = 'AddRegionToUsers1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "region" VARCHAR(100) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "region"`,
    );
  }
}
