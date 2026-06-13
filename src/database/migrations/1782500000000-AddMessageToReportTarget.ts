import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageToReportTarget1782500000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    // Ajout de la valeur 'message' à l'ENUM PostgreSQL — omise lors de la création initiale
    await qr.query(`ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'message'`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // PostgreSQL ne supporte pas DROP VALUE sur un ENUM — la migration inverse est un no-op
  }
}
