import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialTables1780300000000 implements MigrationInterface {
  name = 'CreateSocialTables1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "follows" (
        "follower_id" uuid      NOT NULL,
        "followed_id" uuid      NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows" PRIMARY KEY ("follower_id", "followed_id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_follower"
         FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_followed"
         FOREIGN KEY ("followed_id") REFERENCES "users"("id") ON DELETE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"     uuid      NOT NULL,
        "wish_id"     uuid      NOT NULL,
        "content"     text      NOT NULL,
        "is_reported" boolean   NOT NULL DEFAULT false,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_user"
         FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_wish"
         FOREIGN KEY ("wish_id") REFERENCES "wishes"("id") ON DELETE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "reactions" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid        NOT NULL,
        "wish_id"    uuid        NOT NULL,
        "emoji"      varchar(10) NOT NULL,
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reactions_user_wish" UNIQUE ("user_id", "wish_id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "FK_reactions_user"
         FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "FK_reactions_wish"
         FOREIGN KEY ("wish_id") REFERENCES "wishes"("id") ON DELETE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reactions" DROP CONSTRAINT "FK_reactions_wish"`);
    await queryRunner.query(`ALTER TABLE "reactions" DROP CONSTRAINT "FK_reactions_user"`);
    await queryRunner.query(`DROP TABLE "reactions"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_wish"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_user"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_followed"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_follower"`);
    await queryRunner.query(`DROP TABLE "follows"`);
  }
}
