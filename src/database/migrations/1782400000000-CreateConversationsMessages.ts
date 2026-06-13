import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversationsMessages1782400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE conversations (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_a_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ck_conversation_user_order CHECK (user_a_id < user_b_id),
        CONSTRAINT uq_conversation UNIQUE (user_a_id, user_b_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE messages (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content         TEXT        NOT NULL,
        is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at      TIMESTAMPTZ DEFAULT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_messages_conv_date ON messages(conversation_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversations`);
  }
}
