import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueryFeedDto } from './dto/query-feed.dto';
import {
  FeedEventDto,
  FeedEventType,
  PaginatedFeedDto,
  RawFeedRow,
} from './dto/feed-event.dto';

@Injectable()
export class FeedService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getFeed(userId: string, dto: QueryFeedDto): Promise<PaginatedFeedDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.dataSource.query<RawFeedRow[]>(this.buildPersonalSql(), [userId, limit, offset]),
      this.dataSource.query<[{ count: string }]>(this.buildPersonalCountSql(), [userId]),
    ]);

    return { data: rows.map((row) => this.mapRow(row)), total: parseInt(count, 10), page, limit };
  }

  async getGlobalFeed(dto: QueryFeedDto): Promise<PaginatedFeedDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      this.dataSource.query<RawFeedRow[]>(this.buildGlobalSql(), [limit, offset]),
      this.dataSource.query<[{ count: string }]>(this.buildGlobalCountSql()),
    ]);

    return { data: rows.map((row) => this.mapRow(row)), total: parseInt(count, 10), page, limit };
  }

  private mapRow(row: RawFeedRow): FeedEventDto {
    const event: FeedEventDto = {
      id: row.entity_id,
      type: row.type as FeedEventType,
      occurred_at: new Date(row.occurred_at).toISOString(),
      actor: {
        id: row.actor_id,
        pseudo: row.actor_pseudo,
        avatar_url: row.actor_avatar_url,
        grade: row.actor_grade,
      },
    };
    if (row.wish_id) {
      event.wish = {
        id: row.wish_id,
        title: row.wish_title!,
        category: row.wish_category!,
        media_url: row.wish_media_url,
      };
    }
    if (row.new_grade) {
      event.new_grade = row.new_grade;
    }
    return event;
  }

  // Feed personnel : événements des utilisateurs suivis par $1
  // wish_created : souhaits publics non annulés (story : "X a publié un souhait")
  // wish_fulfilled : souhaits exaucés (story : "Le souhait de X est exaucé")
  // Un souhait fulfilled apparaît dans les 2 buckets à des dates différentes — comportement intentionnel
  private buildPersonalSql(): string {
    return `
      SELECT type, entity_id, occurred_at,
             actor_id, actor_pseudo, actor_avatar_url, actor_grade,
             wish_id, wish_title, wish_category, wish_media_url, new_grade
      FROM (
        SELECT
          'wish_created'::text       AS type,
          w.id::text                 AS entity_id,
          w.created_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          w.id::text                 AS wish_id,
          w.title                    AS wish_title,
          w.category                 AS wish_category,
          w.media_urls[1]            AS wish_media_url,
          NULL::text                 AS new_grade
        FROM wishes w
        JOIN users u ON u.id = w.user_id
        WHERE w.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND w.is_private = false
          AND w.status != 'cancelled'

        UNION ALL

        SELECT
          'wish_fulfilled'::text     AS type,
          w.id::text                 AS entity_id,
          w.updated_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          w.id::text                 AS wish_id,
          w.title                    AS wish_title,
          w.category                 AS wish_category,
          w.media_urls[1]            AS wish_media_url,
          NULL::text                 AS new_grade
        FROM wishes w
        JOIN users u ON u.id = w.user_id
        WHERE w.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND w.is_private = false
          AND w.status = 'fulfilled'

        UNION ALL

        SELECT
          'grade_up'::text           AS type,
          n.id::text                 AS entity_id,
          n.created_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          NULL::text                 AS wish_id,
          NULL::text                 AS wish_title,
          NULL::text                 AS wish_category,
          NULL::text                 AS wish_media_url,
          n.payload->>'currentGrade' AS new_grade
        FROM notifications n
        JOIN users u ON u.id = n.user_id
        WHERE n.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND n.type = 'grade_up'
      ) events
      ORDER BY occurred_at DESC
      LIMIT $2 OFFSET $3
    `;
  }

  private buildPersonalCountSql(): string {
    return `
      SELECT COUNT(*)::int AS count FROM (
        SELECT w.id FROM wishes w
        WHERE w.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND w.is_private = false AND w.status != 'cancelled'
        UNION ALL
        SELECT w.id FROM wishes w
        WHERE w.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND w.is_private = false AND w.status = 'fulfilled'
        UNION ALL
        SELECT n.id FROM notifications n
        WHERE n.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND n.type = 'grade_up'
      ) cnt
    `;
  }

  private buildGlobalSql(): string {
    return `
      SELECT type, entity_id, occurred_at,
             actor_id, actor_pseudo, actor_avatar_url, actor_grade,
             wish_id, wish_title, wish_category, wish_media_url, new_grade
      FROM (
        SELECT
          'wish_created'::text       AS type,
          w.id::text                 AS entity_id,
          w.created_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          w.id::text                 AS wish_id,
          w.title                    AS wish_title,
          w.category                 AS wish_category,
          w.media_urls[1]            AS wish_media_url,
          NULL::text                 AS new_grade
        FROM wishes w
        JOIN users u ON u.id = w.user_id
        WHERE w.is_private = false AND w.status != 'cancelled'

        UNION ALL

        SELECT
          'wish_fulfilled'::text     AS type,
          w.id::text                 AS entity_id,
          w.updated_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          w.id::text                 AS wish_id,
          w.title                    AS wish_title,
          w.category                 AS wish_category,
          w.media_urls[1]            AS wish_media_url,
          NULL::text                 AS new_grade
        FROM wishes w
        JOIN users u ON u.id = w.user_id
        WHERE w.is_private = false AND w.status = 'fulfilled'

        UNION ALL

        SELECT
          'grade_up'::text           AS type,
          n.id::text                 AS entity_id,
          n.created_at               AS occurred_at,
          u.id::text                 AS actor_id,
          u.pseudo                   AS actor_pseudo,
          u.avatar_url               AS actor_avatar_url,
          u.grade                    AS actor_grade,
          NULL::text                 AS wish_id,
          NULL::text                 AS wish_title,
          NULL::text                 AS wish_category,
          NULL::text                 AS wish_media_url,
          n.payload->>'currentGrade' AS new_grade
        FROM notifications n
        JOIN users u ON u.id = n.user_id
        WHERE n.type = 'grade_up'
      ) events
      ORDER BY occurred_at DESC
      LIMIT $1 OFFSET $2
    `;
  }

  private buildGlobalCountSql(): string {
    return `
      SELECT COUNT(*)::int AS count FROM (
        SELECT w.id FROM wishes w WHERE w.is_private = false AND w.status != 'cancelled'
        UNION ALL
        SELECT w.id FROM wishes w WHERE w.is_private = false AND w.status = 'fulfilled'
        UNION ALL
        SELECT n.id FROM notifications n WHERE n.type = 'grade_up'
      ) cnt
    `;
  }
}
