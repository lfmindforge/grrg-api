export class NotificationResponseDto {
  id!: string;
  type!: string;
  payload!: Record<string, unknown>;
  is_read!: boolean;
  created_at!: Date;
}

export class NotificationListDto {
  data!: NotificationResponseDto[];
  unread_count!: number;
}
