import { WishStatus } from '../wish.types';

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
  created_at: Date;
  updated_at: Date;
  user: UserPublicDto;
  donated_amount: number;
  comments_count: number;
}

export interface PaginatedWishesDto {
  data: WishPublicDto[];
  total: number;
  page: number;
  limit: number;
}
