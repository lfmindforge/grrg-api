import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserNotificationPreferences1782300000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_user_notif_pref UNIQUE (user_id, event_type)
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE user_notification_preferences`);
  }
}
