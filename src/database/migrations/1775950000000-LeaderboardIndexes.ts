import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaderboardIndexes1775950000000 implements MigrationInterface {
  name = 'LeaderboardIndexes1775950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_users_glow_points" ON "users"("glow_points" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_evaluations_created_at" ON "evaluations"("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wishes_category_lower" ON "wishes"(LOWER("category"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_wishes_category_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_evaluations_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_glow_points"`);
  }
}
