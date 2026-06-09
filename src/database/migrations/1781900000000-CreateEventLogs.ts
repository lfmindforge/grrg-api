import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventLogs1781900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_logs" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "type"       VARCHAR(50) NOT NULL,
        "actor_id"   UUID        NULL,
        "payload"    JSONB       NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_logs_actor_id"   ON "event_logs" ("actor_id");
      CREATE INDEX "IDX_event_logs_type"       ON "event_logs" ("type");
      CREATE INDEX "IDX_event_logs_created_at" ON "event_logs" ("created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_logs"`);
  }
}
