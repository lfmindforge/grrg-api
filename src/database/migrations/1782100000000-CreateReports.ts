import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReports1782100000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TYPE report_target AS ENUM ('wish', 'comment');
      CREATE TYPE report_reason AS ENUM (
        'inappropriate',
        'spam',
        'harassment',
        'misleading',
        'other'
      );

      CREATE TABLE reports (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type report_target NOT NULL,
        target_id   UUID NOT NULL,
        reason      report_reason NOT NULL,
        details     VARCHAR(300),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT uq_report UNIQUE (reporter_id, target_type, target_id)
      );

      CREATE INDEX idx_reports_target ON reports (target_type, target_id);
      CREATE INDEX idx_reports_reporter ON reports (reporter_id);
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DROP TABLE IF EXISTS reports;
      DROP TYPE IF EXISTS report_reason;
      DROP TYPE IF EXISTS report_target;
    `);
  }
}
