import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBadges1781500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE badges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type VARCHAR(50) NOT NULL,
        period VARCHAR(7) NULL,
        earned_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_badges_user_id ON badges(user_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE badges`);
  }
}
