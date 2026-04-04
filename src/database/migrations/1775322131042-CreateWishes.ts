import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWishes1775322131042 implements MigrationInterface {
  name = 'CreateWishes1775322131042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."wishes_donation_type_enum" AS ENUM('financial', 'delivery', 'in_person')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wishes_status_enum" AS ENUM('pending', 'in_progress', 'fulfilled', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "wishes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(100) NOT NULL, "description" text NOT NULL, "category" character varying(50) NOT NULL, "donation_type" "public"."wishes_donation_type_enum" NOT NULL, "amount" numeric(10,2), "is_private" boolean NOT NULL DEFAULT false, "media_urls" text array NOT NULL DEFAULT '{}', "status" "public"."wishes_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c08d144e42ca0aa37a024597ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishes" ADD CONSTRAINT "FK_ed81ec5a841d42a44c2e64fd46d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wishes" DROP CONSTRAINT "FK_ed81ec5a841d42a44c2e64fd46d"`,
    );
    await queryRunner.query(`DROP TABLE "wishes"`);
    await queryRunner.query(`DROP TYPE "public"."wishes_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."wishes_donation_type_enum"`);
  }
}
