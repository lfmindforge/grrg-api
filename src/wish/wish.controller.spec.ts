import { Test, TestingModule } from '@nestjs/testing';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { DonationType, WishStatus } from './wish.types';

describe('WishController', () => {
  let controller: WishController;
  let service: { findPublic: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    service = {
      findPublic: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    };
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

  it('create() appelle WishService.create avec userId, dto et files, retourne la wish créée', async () => {
    const dto: CreateWishDto = {
      title: 'Mon souhait',
      description: 'Description du souhait',
      category: 'Vêtements',
      donation_type: DonationType.DELIVERY,
    };
    const mockReq = { user: { id: 'user-id-123' } } as any;
    const mockFiles: Express.Multer.File[] = [];
    const createdWish = {
      id: 'uuid-1',
      user_id: 'user-id-123',
      ...dto,
      amount: null,
      is_private: false,
      media_urls: [],
      status: WishStatus.PENDING,
      created_at: new Date(),
      updated_at: new Date(),
    };
    service.create.mockResolvedValue(createdWish);

    const result = await controller.create(mockReq, dto, mockFiles);

    expect(service.create).toHaveBeenCalledWith('user-id-123', dto, []);
    expect(result).toEqual(createdWish);
  });

  it('create() passe undefined files comme tableau vide à WishService.create', async () => {
    const dto: CreateWishDto = {
      title: 'Souhait sans médias',
      description: 'Desc',
      category: 'Autre',
      donation_type: DonationType.IN_PERSON,
    };
    const mockReq = { user: { id: 'user-id-456' } } as any;
    service.create.mockResolvedValue({});

    await controller.create(mockReq, dto, undefined as any);

    expect(service.create).toHaveBeenCalledWith('user-id-456', dto, []);
  });
});
