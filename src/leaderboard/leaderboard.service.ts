import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import {
  LeaderboardResponse,
  LeaderboardView,
  RawLeaderboardRow,
} from './leaderboard.types';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async find(dto: QueryLeaderboardDto): Promise<LeaderboardResponse> {
    const view: LeaderboardView = dto.view ?? 'global';
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    if (view === 'category' && !dto.category) {
      throw new BadRequestException(
        'Le paramètre category est requis pour la vue category',
      );
    }

    const cacheKey = `leaderboard:${view}:${dto.category ?? ''}:${page}:${limit}`;
    const cached = await this.cache.get<LeaderboardResponse>(cacheKey);
    if (cached) return cached;

    const result =
      view === 'monthly'
        ? await this.findMonthly(page, limit)
        : view === 'category'
          ? await this.findByCategory(dto.category!, page, limit)
          : await this.findGlobal(page, limit);

    await this.cache.set(cacheKey, result, 60_000);
    return result;
  }

  private async findGlobal(
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const offset = (page - 1) * limit;
    const [rows, [{ count }]] = await Promise.all([
      this.dataSource.query<
        Array<{
          user_id: string;
          pseudo: string;
          avatar_url: string | null;
          grade: string;
          score: number;
        }>
      >(
        `SELECT id AS user_id, pseudo, avatar_url, grade, glow_points AS score
         FROM users 
         WHERE glow_points > 0
         ORDER BY glow_points DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(*)::int AS count FROM users WHERE glow_points > 0`,
      ),
    ]);
    return {
      data: rows.map((r, i) => ({ rank: offset + i + 1, ...r })),
      total: parseInt(count, 10),
      page,
      limit,
      view: 'global',
    };
  }

  private async findMonthly(
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const offset = (page - 1) * limit;
    const [rows, [{ count }]] = await Promise.all([
      this.dataSource.query<RawLeaderboardRow[]>(
        `SELECT d.donor_id AS user_id, u.pseudo, u.avatar_url, u.grade,
                SUM(e.glow_awarded)::int AS score
         FROM evaluations e
         JOIN donations d ON d.id = e.donation_id
         JOIN users u ON u.id = d.donor_id
         WHERE DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())
         GROUP BY d.donor_id, u.pseudo, u.avatar_url, u.grade
         ORDER BY score DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(DISTINCT d.donor_id)::int AS count
         FROM evaluations e
         JOIN donations d ON d.id = e.donation_id
         WHERE DATE_TRUNC('month', e.created_at) = DATE_TRUNC('month', NOW())`,
      ),
    ]);
    return {
      data: rows.map((r, i) => ({ rank: offset + i + 1, ...r })),
      total: parseInt(count, 10),
      page,
      limit,
      view: 'monthly',
    };
  }

  private async findByCategory(
    category: string,
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const offset = (page - 1) * limit;
    const [rows, [{ count }]] = await Promise.all([
      this.dataSource.query<RawLeaderboardRow[]>(
        `SELECT d.donor_id AS user_id, u.pseudo, u.avatar_url, u.grade,
                SUM(e.glow_awarded)::int AS score
         FROM evaluations e
         JOIN donations d ON d.id = e.donation_id
         JOIN wishes w ON w.id = d.wish_id
         JOIN users u ON u.id = d.donor_id
         WHERE LOWER(w.category) = LOWER($1)
         GROUP BY d.donor_id, u.pseudo, u.avatar_url, u.grade
         ORDER BY score DESC LIMIT $2 OFFSET $3`,
        [category, limit, offset],
      ),
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(DISTINCT d.donor_id)::int AS count
         FROM evaluations e
         JOIN donations d ON d.id = e.donation_id
         JOIN wishes w ON w.id = d.wish_id
         WHERE LOWER(w.category) = LOWER($1)`,
        [category],
      ),
    ]);
    return {
      data: rows.map((r, i) => ({ rank: offset + i + 1, ...r })),
      total: parseInt(count, 10),
      page,
      limit,
      view: 'category',
    };
  }
}
