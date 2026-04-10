import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToEvaluations1775800000000 implements MigrationInterface {
  name = 'AddDescriptionToEvaluations1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluations" ADD "description" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" ALTER COLUMN "description" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluations" DROP COLUMN "description"`,
    );
  }
}
