export class MessageResponseDto {
  id!: string;
  conversation_id!: string;
  sender_id!: string;
  sender_pseudo!: string;
  sender_avatar!: string | null;
  content!: string;
  is_read!: boolean;
  created_at!: Date;
}

export class ConversationResponseDto {
  id!: string;
  other_user!: { id: string; pseudo: string; avatar_url: string | null; grade: string };
  last_message!: MessageResponseDto | null;
  unread_count!: number;
  updated_at!: Date;
}
