export enum NotificationType {
  DONATION_RECEIVED = 'donation_received',
  EVALUATION_RECEIVED = 'evaluation_received',
  COMMENT_RECEIVED = 'comment_received',
  REACTION_RECEIVED = 'reaction_received',
  GRADE_UP = 'grade_up',
  BADGE_EARNED = 'badge_earned',
  NEW_FOLLOWER = 'new_follower',
  WISH_EXPIRED = 'wish_expired',
  MESSAGE_RECEIVED = 'message_received',
}

export function truncateTitle(title: string, max = 50): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}
