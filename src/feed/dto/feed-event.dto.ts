export type FeedEventType = 'wish_created' | 'wish_fulfilled' | 'grade_up';

export interface FeedActorDto {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  grade: string;
}

export interface FeedWishDto {
  id: string;
  title: string;
  category: string;
  media_url: string | null;
}

export interface FeedEventDto {
  id: string;
  type: FeedEventType;
  occurred_at: string;
  actor: FeedActorDto;
  wish?: FeedWishDto;
  new_grade?: string;
}

export interface PaginatedFeedDto {
  data: FeedEventDto[];
  total: number;
  page: number;
  limit: number;
}

// Ligne brute retournée par les requêtes SQL UNION
export interface RawFeedRow {
  type: string;
  entity_id: string;
  occurred_at: Date | string;
  actor_id: string;
  actor_pseudo: string;
  actor_avatar_url: string | null;
  actor_grade: string;
  wish_id: string | null;
  wish_title: string | null;
  wish_category: string | null;
  wish_media_url: string | null;
  new_grade: string | null;
}
