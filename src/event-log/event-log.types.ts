export enum EventType {
  USER_REGISTER     = 'user.register',
  USER_LOGIN        = 'user.login',
  USER_LOGIN_FAILED = 'user.login_failed',
  USER_LOGIN_OAUTH  = 'user.login_oauth',
  USER_LOGOUT       = 'user.logout',
  USER_UPDATE       = 'user.update',
  USER_DELETE       = 'user.delete',
  USER_EXPORT       = 'user.export',

  WISH_CREATE = 'wish.create',
  WISH_UPDATE = 'wish.update',
  WISH_DELETE = 'wish.delete',

  DONATION_CREATE  = 'donation.create',
  DONATION_CONFIRM = 'donation.confirm',

  EVALUATION_CREATE = 'evaluation.create',

  COMMENT_CREATE = 'comment.create',
  COMMENT_DELETE = 'comment.delete',

  FOLLOW_CREATE = 'follow.create',
  FOLLOW_DELETE = 'follow.delete',

  REACTION_UPSERT = 'reaction.upsert',
  REACTION_DELETE = 'reaction.delete',

  BADGE_AWARD = 'badge.award',

  REPORT_CREATE = 'report.create',

  ADMIN_BAN            = 'admin.ban',
  ADMIN_UNBAN          = 'admin.unban',
  ADMIN_CONTENT_DELETE = 'admin.content_delete',
}
