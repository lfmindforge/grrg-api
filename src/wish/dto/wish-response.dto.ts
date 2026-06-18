import { WishStatus } from '../wish.types';

export interface ReactionCountDto {
  emoji: string;
  count: number;
}

export interface UserPublicDto {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  grade: string;
  glow_points: number;
}

export interface WishPublicDto {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  is_private: boolean;
  media_urls: string[];
  status: WishStatus;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  user: UserPublicDto;
  donated_amount: number;
  comments_count?: number;
  reactions: ReactionCountDto[];
  evaluation_note?: string | null;
}

export interface PaginatedWishesDto {
  data: WishPublicDto[];
  total: number;
  page: number;
  limit: number;
}
