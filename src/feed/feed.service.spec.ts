import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { FeedService } from './feed.service';
import { PaginatedFeedDto } from './dto/feed-event.dto';

const mockDataSource = { query: jest.fn() };

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<FeedService>(FeedService);
    jest.clearAllMocks();
  });

  describe('getFeed', () => {
    it('retourne les événements correctement mappés (wish_created + grade_up)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            type: 'wish_created',
            entity_id: 'w1',
            occurred_at: new Date('2026-01-10T10:00:00Z'),
            actor_id: 'u1',
            actor_pseudo: 'Alice',
            actor_avatar_url: null,
            actor_grade: 'etincelle',
            wish_id: 'w1',
            wish_title: 'Un vélo',
            wish_category: 'Transport',
            wish_media_url: 'https://cdn.example.com/w1.jpg',
            new_grade: null,
          },
          {
            type: 'grade_up',
            entity_id: 'n1',
            occurred_at: new Date('2026-01-11T10:00:00Z'),
            actor_id: 'u1',
            actor_pseudo: 'Alice',
            actor_avatar_url: null,
            actor_grade: 'lumiere',
            wish_id: null,
            wish_title: null,
            wish_category: null,
            wish_media_url: null,
            new_grade: 'lumiere',
          },
        ])
        .mockResolvedValueOnce([{ count: '2' }]);

      const result: PaginatedFeedDto = await service.getFeed('follower-uid', {});

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.data[0].type).toBe('wish_created');
      expect(result.data[0].wish?.title).toBe('Un vélo');
      expect(result.data[0].wish?.media_url).toBe('https://cdn.example.com/w1.jpg');
      expect(result.data[0].new_grade).toBeUndefined();
      expect(result.data[1].type).toBe('grade_up');
      expect(result.data[1].new_grade).toBe('lumiere');
      expect(result.data[1].wish).toBeUndefined();
    });

    it('retourne data:[] et total:0 quand le follow set est vide', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getFeed('lonely-uid', {});

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('passe le bon LIMIT et OFFSET selon page et limit', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      await service.getFeed('u1', { page: 3, limit: 10 });

      const params: unknown[] = mockDataSource.query.mock.calls[0][1];
      // [0] = follower_id, [1] = limit, [2] = offset
      expect(params[1]).toBe(10);
      expect(params[2]).toBe(20); // offset = (3-1) * 10
    });

    it('inclut le follower_id dans la requête SQL personnelle', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      await service.getFeed('user-abc', {});

      const params: unknown[] = mockDataSource.query.mock.calls[0][1];
      expect(params[0]).toBe('user-abc');
      const sql: string = mockDataSource.query.mock.calls[0][0];
      expect(sql).toContain('follower_id');
    });
  });

  describe('getGlobalFeed', () => {
    it('retourne les événements globaux sans filtre de follower_id', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            type: 'wish_fulfilled',
            entity_id: 'w2',
            occurred_at: new Date('2026-01-15T10:00:00Z'),
            actor_id: 'u2',
            actor_pseudo: 'Bob',
            actor_avatar_url: 'https://cdn.example.com/bob.jpg',
            actor_grade: 'lumiere',
            wish_id: 'w2',
            wish_title: 'Une guitare',
            wish_category: 'Musique',
            wish_media_url: null,
            new_grade: null,
          },
        ])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.getGlobalFeed({});

      const sql: string = mockDataSource.query.mock.calls[0][0];
      expect(sql).not.toContain('follower_id');
      expect(result.data[0].type).toBe('wish_fulfilled');
      expect(result.data[0].wish?.title).toBe('Une guitare');
      expect(result.data[0].wish?.media_url).toBeNull();
    });

    it('applique la pagination correctement', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      await service.getGlobalFeed({ page: 2, limit: 5 });

      const params: unknown[] = mockDataSource.query.mock.calls[0][1];
      expect(params[0]).toBe(5);  // limit
      expect(params[1]).toBe(5);  // offset = (2-1) * 5
    });
  });
});
