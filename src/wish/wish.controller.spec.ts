import { Test, TestingModule } from '@nestjs/testing';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';

describe('WishController', () => {
  let controller: WishController;
  let service: { findPublic: jest.Mock };

  beforeEach(async () => {
    service = { findPublic: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishController],
      providers: [{ provide: WishService, useValue: service }],
    }).compile();
    controller = module.get<WishController>(WishController);
    jest.clearAllMocks();
  });

  it('findPublic() appelle WishService.findPublic et retourne []', async () => {
    service.findPublic.mockResolvedValue([]);
    const result = await controller.findPublic();
    expect(service.findPublic).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});
