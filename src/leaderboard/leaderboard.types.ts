export type LeaderboardView = 'global' | 'monthly' | 'category';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  grade: string;
  score: number;
}

// Type des lignes brutes retournées par dataSource.query() — rank est calculé côté service
export type RawLeaderboardRow = Omit<LeaderboardEntry, 'rank'>;

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  view: LeaderboardView;
}
