import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDonationsAndEvaluations1775759627490 implements MigrationInterface {
  name = 'CreateDonationsAndEvaluations1775759627490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."donations_type_enum" AS ENUM('financial', 'delivery', 'in_person')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_status_enum" AS ENUM('pending', 'completed')`,
    );
    await queryRunner.query(`
        CREATE TABLE "donations" (
          "id"                 uuid        NOT NULL DEFAULT uuid_generate_v4(),
          "wish_id"            uuid        NOT NULL,
          "donor_id"           uuid        NOT NULL,
          "type"               "public"."donations_type_enum" NOT NULL,
          "amount"             numeric(10,2),
          "nature_description" text,
          "is_anonymous"       boolean     NOT NULL DEFAULT false,
          "status"             "public"."donations_status_enum" NOT NULL DEFAULT 'pending',
          "created_at"         TIMESTAMP   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_donations" PRIMARY KEY ("id")
        )
      `);
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_donations_wish"
         FOREIGN KEY ("wish_id") REFERENCES "wishes"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "FK_donations_donor"
         FOREIGN KEY ("donor_id") REFERENCES "users"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluations_satisfaction_enum" AS ENUM('neutral', 'happy', 'thrilled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evaluations_bonus_enum" AS ENUM('none', 'on_time', 'went_above_and_beyond')`,
    );
    await queryRunner.query(`
        CREATE TABLE "evaluations" (
          "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
          "donation_id"  uuid        NOT NULL,
          "satisfaction" "public"."evaluations_satisfaction_enum" NOT NULL,
          "bonus"        "public"."evaluations_bonus_enum" NOT NULL DEFAULT 'none',
          "glow_awarded" integer     NOT NULL DEFAULT 0,
          "proof_url"    text,
          "created_at"   TIMESTAMP   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_evaluations" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_evaluations_donation" UNIQUE ("donation_id")
        )
      `);
    await queryRunner.query(
      `ALTER TABLE "evaluations" ADD CONSTRAINT "FK_evaluations_donation"
         FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluations" DROP CONSTRAINT "FK_evaluations_donation"`,
    );
    await queryRunner.query(`DROP TABLE "evaluations"`);
    await queryRunner.query(`DROP TYPE "public"."evaluations_bonus_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."evaluations_satisfaction_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_donations_donor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP CONSTRAINT "FK_donations_wish"`,
    );
    await queryRunner.query(`DROP TABLE "donations"`);
    await queryRunner.query(`DROP TYPE "public"."donations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."donations_type_enum"`);
  }
}
