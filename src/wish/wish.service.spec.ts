import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { WishService } from './wish.service';
import { Wish } from './wish.entity';
import { SupabaseStorageService } from './supabase-storage.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { DonationType, WishStatus } from './wish.types';

describe('WishService', () => {
  let service: WishService;
  let wishRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let supabaseStorage: { upload: jest.Mock };

  beforeEach(async () => {
    wishRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn() };
    supabaseStorage = { upload: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishService,
        { provide: getRepositoryToken(Wish), useValue: wishRepo },
        { provide: SupabaseStorageService, useValue: supabaseStorage },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'wishes-media' },
        },
      ],
    }).compile();

    service = module.get<WishService>(WishService);
    jest.clearAllMocks();
  });

  const dto: CreateWishDto = {
    title: 'Mon souhait',
    description: 'Un beau souhait',
    category: 'Électronique',
    donation_type: DonationType.FINANCIAL,
  };

  const mockFile = {
    buffer: Buffer.from('img'),
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
  } as Express.Multer.File;

  describe('findPublic()', () => {
    it('appelle wishRepo.find avec is_private = false et retourne les résultats', async () => {
      wishRepo.find.mockResolvedValue([]);
      const result = await service.findPublic();
      expect(wishRepo.find).toHaveBeenCalledWith({
        where: { is_private: false },
      });
      expect(result).toEqual([]);
    });
  });

  describe('create()', () => {
    it('sans fichiers : insère en DB avec media_urls vide et status pending', async () => {
      const savedWish = {
        id: 'uuid-1',
        ...dto,
        user_id: 'user-id',
        media_urls: [],
        status: WishStatus.PENDING,
      };
      wishRepo.create.mockReturnValue(savedWish);
      wishRepo.save.mockResolvedValue(savedWish);

      const result = await service.create('user-id', dto, []);

      expect(supabaseStorage.upload).not.toHaveBeenCalled();
      expect(wishRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-id',
          media_urls: [],
          status: WishStatus.PENDING,
          amount: null,
          is_private: false,
        }),
      );
      expect(result.status).toBe(WishStatus.PENDING);
    });

    it('avec fichiers : upload vers Supabase et stocke les URLs dans media_urls', async () => {
      supabaseStorage.upload.mockResolvedValue(
        'https://cdn.supabase.co/photo.jpg',
      );
      const savedWish = {
        id: 'uuid-1',
        ...dto,
        user_id: 'user-id',
        media_urls: ['https://cdn.supabase.co/photo.jpg'],
        status: WishStatus.PENDING,
      };
      wishRepo.create.mockReturnValue(savedWish);
      wishRepo.save.mockResolvedValue(savedWish);

      const result = await service.create('user-id', dto, [mockFile]);

      expect(supabaseStorage.upload).toHaveBeenCalledTimes(1);
      expect(supabaseStorage.upload).toHaveBeenCalledWith(
        'wishes-media',
        expect.stringMatching(/^user-id\/.+\.jpg$/),
        mockFile,
      );
      expect(wishRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          media_urls: ['https://cdn.supabase.co/photo.jpg'],
        }),
      );
      expect(result.media_urls).toEqual(['https://cdn.supabase.co/photo.jpg']);
    });

    it("si Supabase échoue : lance l'exception et n'insère rien en DB", async () => {
      supabaseStorage.upload.mockRejectedValue(
        new InternalServerErrorException('Échec upload Supabase'),
      );

      await expect(service.create('user-id', dto, [mockFile])).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(wishRepo.save).not.toHaveBeenCalled();
    });

    it('avec amount et is_private : les valeurs sont transmises à la DB', async () => {
      const dtoWithAmount: CreateWishDto = {
        ...dto,
        amount: 50,
        is_private: true,
      };
      const savedWish = {
        id: 'uuid-2',
        ...dtoWithAmount,
        user_id: 'user-id',
        media_urls: [],
        status: WishStatus.PENDING,
      };
      wishRepo.create.mockReturnValue(savedWish);
      wishRepo.save.mockResolvedValue(savedWish);

      await service.create('user-id', dtoWithAmount, []);

      expect(wishRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, is_private: true }),
      );
    });
  });
});
