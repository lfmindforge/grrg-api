import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDonationTypeFromWishes1778889600000 implements MigrationInterface {
  name = 'RemoveDonationTypeFromWishes1778889600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wishes" DROP COLUMN "donation_type"`);
    await queryRunner.query(`ALTER TABLE "wishes" DROP COLUMN "amount"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wishes" ADD "amount" numeric(10,2)`);
    await queryRunner.query(
      `ALTER TABLE "wishes" ADD "donation_type" character varying NOT NULL DEFAULT 'financial'`,
    );
  }
}
