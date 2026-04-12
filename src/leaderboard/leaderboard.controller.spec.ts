import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

const mockService = { find: jest.fn() };

describe('LeaderboardController', () => {
  let controller: LeaderboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [{ provide: LeaderboardService, useValue: mockService }],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    jest.clearAllMocks();
  });

  it('GET /leaderboard sans params → délègue à find({}) et retourne view=global', async () => {
    mockService.find.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, view: 'global' });

    const result = await controller.find({});

    expect(mockService.find).toHaveBeenCalledWith({});
    expect(result.view).toBe('global');
  });

  it('GET /leaderboard?view=category sans category → propage BadRequestException', async () => {
    mockService.find.mockRejectedValue(new BadRequestException('category requis'));

    await expect(controller.find({ view: 'category' })).rejects.toThrow(BadRequestException);
  });

  it('GET /leaderboard?view=monthly&page=2&limit=10 → retourne les bonnes métadonnées', async () => {
    mockService.find.mockResolvedValue({ data: [], total: 5, page: 2, limit: 10, view: 'monthly' });

    const result = await controller.find({ view: 'monthly', page: 2, limit: 10 });

    expect(result.view).toBe('monthly');
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });
});
