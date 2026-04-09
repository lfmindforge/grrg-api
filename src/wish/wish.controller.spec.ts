import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { QueryWishDto } from './dto/query-wish.dto';
import { DonationType, WishStatus } from './wish.types';

describe('WishController', () => {
  let controller: WishController;
  let service: {
    findPublic: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findPublic: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishController],
      providers: [{ provide: WishService, useValue: service }],
    }).compile();
    controller = module.get<WishController>(WishController);
    jest.clearAllMocks();
  });

  describe('findPublic()', () => {
    it('appelle WishService.findPublic avec le query DTO et retourne le résultat paginé', async () => {
      const query: QueryWishDto = { page: 1, limit: 20 };
      const paginatedResult = { data: [], total: 0, page: 1, limit: 20 };
      service.findPublic.mockResolvedValue(paginatedResult);

      const result = await controller.findPublic(query);

      expect(service.findPublic).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne()', () => {
    it("appelle WishService.findOne avec l'id et retourne le souhait", async () => {
      const mockWish = {
        id: 'uuid-1',
        title: 'Test',
        user: { pseudo: 'alice' },
      };
      service.findOne.mockResolvedValue(mockWish);

      const result = await controller.findOne('uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(mockWish);
    });

    it('ParseUUIDPipe rejette un id non-UUID avec BadRequestException', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(
        pipe.transform('pas-un-uuid', { type: 'param' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create()', () => {
    it('appelle WishService.create avec userId, dto et files, retourne la wish créée', async () => {
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

    it('passe undefined files comme tableau vide à WishService.create', async () => {
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
});
