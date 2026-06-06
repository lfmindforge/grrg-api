import { WishStatus } from '../wish/wish.types';
import { BadgeDto } from '../badge/badge.types';

export type CreateUserData = {
  email: string;
  password_hash: string | null;
  pseudo: string;
  birthdate?: Date | null;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_id?: string | null;
};

export interface WishPreviewDto {
  id: string;
  title: string;
  cover: string | null; // media_urls[0] ou null si aucun média
  status: WishStatus;
}

export interface UserPublicProfileDto {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  grade: string;
  glow_points: number;
  badges: BadgeDto[];
  donations_count: number;
  followers_count: number;
  following_count: number;
  gallery: WishPreviewDto[];
}
