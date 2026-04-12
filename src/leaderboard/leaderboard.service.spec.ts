import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardResponse } from './leaderboard.types';

const mockDataSource = { query: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  describe('vue global', () => {
    it('retourne le classement paginé trié par glow_points DESC avec rank calculé', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          { user_id: 'u1', pseudo: 'Alice', avatar_url: null, grade: 'mecene', score: 500 },
          { user_id: 'u2', pseudo: 'Bob', avatar_url: null, grade: 'etincelle', score: 100 },
        ])
        .mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.find({ view: 'global', page: 1, limit: 20 });

      expect(result.view).toBe('global');
      expect(result.total).toBe(2);
      expect(result.data[0].rank).toBe(1);
      expect(result.data[0].user_id).toBe('u1');
      expect(result.data[0].score).toBe(500);
      expect(result.data[1].rank).toBe(2);
    });

    it('calcule le rank en tenant compte du offset (page 2)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          { user_id: 'u3', pseudo: 'Carol', avatar_url: null, grade: 'lumiere', score: 80 },
        ])
        .mockResolvedValueOnce([{ count: '3' }]);

      const result = await service.find({ view: 'global', page: 2, limit: 2 });

      expect(result.data[0].rank).toBe(3); // offset = (2-1)*2 = 2, donc rank = 3
    });
  });

  describe('vue monthly', () => {
    it("n'inclut que les évaluations du mois calendaire en cours (filtre DATE_TRUNC)", async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          { user_id: 'u1', pseudo: 'Alice', avatar_url: null, grade: 'lumiere', score: 120 },
        ])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.find({ view: 'monthly', page: 1, limit: 20 });

      const sql: string = mockDataSource.query.mock.calls[0][0];
      expect(sql).toContain("DATE_TRUNC('month'");
      expect(result.view).toBe('monthly');
      expect(result.data[0].score).toBe(120);
    });
  });

  describe('vue category', () => {
    it('filtre par catégorie (case-insensitive) et retourne le bon score', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          { user_id: 'u1', pseudo: 'Alice', avatar_url: null, grade: 'etincelle', score: 40 },
        ])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.find({ view: 'category', category: 'Livres', page: 1, limit: 20 });

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('LOWER(w.category) = LOWER($1)');
      expect(params[0]).toBe('Livres');
      expect(result.view).toBe('category');
      expect(result.data[0].score).toBe(40);
    });

    it('lève BadRequestException si category est absent', async () => {
      await expect(service.find({ view: 'category' })).rejects.toThrow(BadRequestException);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('cache', () => {
    it('retourne le résultat en cache sans appeler dataSource.query', async () => {
      const cached: LeaderboardResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        view: 'global',
      };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.find({ view: 'global' });

      expect(result).toBe(cached);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('met en cache le résultat avec TTL 60s après un miss', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      await service.find({ view: 'global', page: 1, limit: 20 });

      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:global::1:20',
        expect.any(Object),
        60_000,
      );
    });
  });
});
