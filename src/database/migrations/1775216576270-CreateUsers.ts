import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1775216576270 implements MigrationInterface {
  name = 'CreateUsers1775216576270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying, "pseudo" character varying(50) NOT NULL, "avatar_url" text, "oauth_provider" character varying(20), "oauth_id" character varying, "glow_points" integer NOT NULL DEFAULT '0', "grade" character varying(30) NOT NULL DEFAULT 'etincelle', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_c18dc5127c28389fb4ca1d8fb3c" UNIQUE ("pseudo"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
