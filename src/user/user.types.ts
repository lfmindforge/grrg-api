import { WishStatus } from '../wish/wish.types';

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
  badges: unknown[]; // placeholder — branché en US-014
  donations_count: number; // placeholder — 0 jusqu'à US-009
  gallery: WishPreviewDto[];
}
