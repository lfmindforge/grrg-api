import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WishService } from './wish.service';
import { Wish } from './wish.entity';
import { SupabaseStorageService } from './supabase-storage.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { QueryWishDto } from './dto/query-wish.dto';
import { PaginatedWishesDto, WishPublicDto } from './dto/wish-response.dto';
import { DonationType, WishStatus } from './wish.types';
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

describe('WishService', () => {
  let service: WishService;
  let wishRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockQb: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
    getOne: jest.Mock;
  };
  let supabaseStorage: { upload: jest.Mock };

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    wishRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
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

  // --- findPublic() ---

  describe('findPublic()', () => {
    it('retourne une réponse paginée avec les valeurs par défaut (page=1, limit=20)', async () => {
      const wish = { id: 'uuid-1', title: 'Test', is_private: false };
      mockQb.getManyAndCount.mockResolvedValue([[wish], 1]);

      const result: PaginatedWishesDto = await service.findPublic({});

      expect(wishRepo.createQueryBuilder).toHaveBeenCalledWith('wish');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith(
        'wish.user',
        'user',
      );
      expect(mockQb.where).toHaveBeenCalledWith(
        'wish.is_private = :isPrivate',
        { isPrivate: false },
      );
      expect(result).toEqual({ data: [wish], total: 1, page: 1, limit: 20 });
    });

    it("exclut les souhaits 'cancelled' par défaut (aucun filtre status)", async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({});

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'wish.status != :cancelled',
        { cancelled: WishStatus.CANCELLED },
      );
    });

    it("inclut 'cancelled' si status=cancelled est fourni explicitement", async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ status: WishStatus.CANCELLED });

      expect(mockQb.andWhere).toHaveBeenCalledWith('wish.status = :status', {
        status: WishStatus.CANCELLED,
      });
    });

    it('filtre par category (insensible à la casse)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ category: 'Électronique' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'LOWER(wish.category) = LOWER(:category)',
        { category: 'Électronique' },
      );
    });

    it('filtre par donation_type', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ donation_type: DonationType.DELIVERY });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'wish.donation_type = :donationType',
        { donationType: DonationType.DELIVERY },
      );
    });

    it('recherche par mot-clé (ILIKE sur title et description)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ search: 'vélo' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(wish.title ILIKE :search OR wish.description ILIKE :search)',
        { search: '%vélo%' },
      );
    });

    it('trie par popularité avec wish.created_at (placeholder — COUNT donations en US-007)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ sort: 'popularity' });

      expect(mockQb.orderBy).toHaveBeenCalledWith('wish.created_at', 'DESC');
    });

    it('applique la pagination : page=2, limit=10 → skip=10, take=10', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPublic({ page: 2, limit: 10 });

      expect(mockQb.skip).toHaveBeenCalledWith(10);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  // --- findOne() ---

  describe('findOne()', () => {
    const mockWish = {
      id: 'uuid-1',
      title: 'Mon souhait',
      is_private: false,
      user: {
        id: 'user-1',
        pseudo: 'alice',
        avatar_url: null,
        grade: 'etincelle',
        glow_points: 0,
      },
    };

    it('retourne le souhait avec le user si trouvé', async () => {
      mockQb.getOne.mockResolvedValue(mockWish);

      const result: WishPublicDto = await service.findOne('uuid-1');

      expect(wishRepo.createQueryBuilder).toHaveBeenCalledWith('wish');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith(
        'wish.user',
        'user',
      );
      expect(result).toEqual(mockWish);
    });

    it('lève NotFoundException si le souhait est introuvable', async () => {
      mockQb.getOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lève NotFoundException si le souhait est privé (is_private=false dans la query → getOne retourne null)', async () => {
      mockQb.getOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-prive')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- create() ---

  describe('create()', () => {
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

  // --- findMine() ---

  describe('findMine()', () => {
    it('retourne une réponse paginée avec les valeurs par défaut (page=1, limit=20)', async () => {
      const wish = { id: 'uuid-1', user_id: 'user-id', is_private: false };
      mockQb.getManyAndCount.mockResolvedValue([[wish], 1]);

      const result: PaginatedWishesDto = await service.findMine('user-id', {});

      expect(wishRepo.createQueryBuilder).toHaveBeenCalledWith('wish');
      expect(mockQb.where).toHaveBeenCalledWith('wish.user_id = :userId', {
        userId: 'user-id',
      });
      expect(result).toEqual({ data: [wish], total: 1, page: 1, limit: 20 });
    });

    it('filtre uniquement les souhaits du user connecté', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMine('user-id-specifique', {});

      expect(mockQb.where).toHaveBeenCalledWith('wish.user_id = :userId', {
        userId: 'user-id-specifique',
      });
    });

    it('inclut les souhaits privés — aucun filtre is_private appliqué', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMine('user-id', {});

      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('is_private'),
        expect.anything(),
      );
    });

    it("inclut les souhaits 'cancelled' — aucun filtre status par défaut", async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMine('user-id', {});

      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.anything(),
      );
    });

    it('filtre par status si fourni explicitement', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMine('user-id', { status: WishStatus.PENDING });

      expect(mockQb.andWhere).toHaveBeenCalledWith('wish.status = :status', {
        status: WishStatus.PENDING,
      });
    });
  });

  // --- update() ---

  describe('update()', () => {
    it("lève NotFoundException si le souhait n'existe pas", async () => {
      wishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('uuid-inexistant', 'user-id', { title: 'Nouveau' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si le user n'est pas le propriétaire", async () => {
      wishRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        user_id: 'autre-user',
      });

      await expect(
        service.update('uuid-1', 'user-id', { title: 'Nouveau' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('merge partiel — ne modifie que les champs fournis', async () => {
      const existingWish = {
        id: 'uuid-1',
        user_id: 'user-id',
        title: 'Ancien',
        description: 'Desc originale',
      };
      wishRepo.findOne.mockResolvedValue(existingWish);
      wishRepo.save.mockImplementation((w) => Promise.resolve(w));

      await service.update('uuid-1', 'user-id', { title: 'Nouveau' });

      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nouveau',
          description: 'Desc originale',
        }),
      );
    });

    it('persiste et retourne le souhait mis à jour', async () => {
      const existingWish = {
        id: 'uuid-1',
        user_id: 'user-id',
        title: 'Ancien',
      };
      const updatedWish = { ...existingWish, title: 'Nouveau' };
      wishRepo.findOne.mockResolvedValue(existingWish);
      wishRepo.save.mockResolvedValue(updatedWish);

      const result = await service.update('uuid-1', 'user-id', {
        title: 'Nouveau',
      });

      expect(result).toEqual(updatedWish);
    });
  });

  // --- softDelete() ---

  describe('softDelete()', () => {
    it("lève NotFoundException si le souhait n'existe pas", async () => {
      wishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.softDelete('uuid-inexistant', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si le user n'est pas le propriétaire", async () => {
      wishRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        user_id: 'autre-user',
        status: WishStatus.PENDING,
      });

      await expect(service.softDelete('uuid-1', 'user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('passe status = CANCELLED et sauvegarde', async () => {
      const wish = {
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.PENDING,
      };
      wishRepo.findOne.mockResolvedValue(wish);
      wishRepo.save.mockResolvedValue({
        ...wish,
        status: WishStatus.CANCELLED,
      });

      await service.softDelete('uuid-1', 'user-id');

      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WishStatus.CANCELLED }),
      );
    });

    it('idempotent — si déjà CANCELLED, ne rappelle pas save()', async () => {
      wishRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.CANCELLED,
      });

      await service.softDelete('uuid-1', 'user-id');

      expect(wishRepo.save).not.toHaveBeenCalled();
    });
  });
});
