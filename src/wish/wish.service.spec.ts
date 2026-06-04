import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WishService } from './wish.service';
import { Wish } from './wish.entity';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { QueryWishDto } from './dto/query-wish.dto';
import { PaginatedWishesDto, WishPublicDto } from './dto/wish-response.dto';
import { WishStatus } from './wish.types';
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
    select: jest.Mock;
    distinct: jest.Mock;
    addSelect: jest.Mock;
    getManyAndCount: jest.Mock;
    getCount: jest.Mock;
    getOne: jest.Mock;
    getRawMany: jest.Mock;
    getRawAndEntities: jest.Mock;
  };
  let supabaseStorage: { upload: jest.Mock; delete: jest.Mock; extractPath: jest.Mock };

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      getOne: jest.fn().mockResolvedValue(null),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
    };
    wishRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
    supabaseStorage = {
      upload: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      extractPath: jest.fn().mockReturnValue('user-id/photo.jpg'),
    };

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
      mockQb.getCount.mockResolvedValue(1);
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [wish],
        raw: [{ comments_count: '0' }],
      });

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
      expect(result).toEqual({
        data: [{ ...wish, comments_count: 0 }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it("exclut les souhaits 'cancelled' par défaut (aucun filtre status)", async () => {
      await service.findPublic({});

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'wish.status != :cancelled',
        { cancelled: WishStatus.CANCELLED },
      );
    });

    it("inclut 'cancelled' si status=cancelled est fourni explicitement", async () => {
      await service.findPublic({ status: WishStatus.CANCELLED });

      expect(mockQb.andWhere).toHaveBeenCalledWith('wish.status = :status', {
        status: WishStatus.CANCELLED,
      });
    });

    it('filtre par category (insensible à la casse)', async () => {
      await service.findPublic({ category: 'Électronique' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'LOWER(wish.category) = LOWER(:category)',
        { category: 'Électronique' },
      );
    });

    it('recherche par mot-clé (ILIKE sur title et description)', async () => {
      await service.findPublic({ search: 'vélo' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(wish.title ILIKE :search OR wish.description ILIKE :search)',
        { search: '%vélo%' },
      );
    });

    it('trie par popularité via COUNT des donations sur le souhait', async () => {
      await service.findPublic({ sort: 'popularity' });

      expect(mockQb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(d.id)'),
        'donations_count',
      );
      expect(mockQb.orderBy).toHaveBeenCalledWith('donations_count', 'DESC');
    });

    it('applique la pagination : page=2, limit=10 → skip=10, take=10', async () => {
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

    it('retourne le souhait avec donated_amount calculé depuis les dons completed', async () => {
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [mockWish],
        raw: [{ donated_amount: '150.00' }],
      });

      const result = await service.findOne('uuid-1');

      expect(wishRepo.createQueryBuilder).toHaveBeenCalledWith('wish');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith(
        'wish.user',
        'user',
      );
      expect(result).toMatchObject(mockWish);
      expect(result.donated_amount).toBe(150);
    });

    it('donated_amount vaut 0 si aucun don confirmé (SUM retourne null)', async () => {
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [mockWish],
        raw: [{ donated_amount: null }],
      });

      const result = await service.findOne('uuid-1');

      expect(result.donated_amount).toBe(0);
    });

    it('lève NotFoundException si le souhait est introuvable ou privé', async () => {
      mockQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

      await expect(service.findOne('uuid-inexistant')).rejects.toThrow(
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

    it('avec is_private : la valeur est transmise à la DB', async () => {
      const dtoWithPrivate: CreateWishDto = {
        ...dto,
        is_private: true,
      };
      const savedWish = {
        id: 'uuid-2',
        ...dtoWithPrivate,
        user_id: 'user-id',
        media_urls: [],
        status: WishStatus.PENDING,
      };
      wishRepo.create.mockReturnValue(savedWish);
      wishRepo.save.mockResolvedValue(savedWish);

      await service.create('user-id', dtoWithPrivate, []);

      expect(wishRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: true }),
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

    it('avec fichier + status PENDING : upload et remplace media_urls', async () => {
      const oldUrl = 'https://proj.supabase.co/storage/v1/object/public/wishes-media/user-id/old.jpg';
      const wish = {
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.PENDING,
        media_urls: [oldUrl],
      };
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'new.jpg',
      } as Express.Multer.File;
      const newUrl = 'https://proj.supabase.co/storage/v1/object/public/wishes-media/user-id/new.jpg';
      wishRepo.findOne.mockResolvedValue(wish);
      supabaseStorage.extractPath.mockReturnValue('user-id/old.jpg');
      supabaseStorage.upload.mockResolvedValue(newUrl);
      wishRepo.save.mockImplementation((w) => Promise.resolve(w));

      await service.update('uuid-1', 'user-id', {}, file);

      expect(supabaseStorage.delete).toHaveBeenCalledWith('wishes-media', ['user-id/old.jpg']);
      expect(supabaseStorage.upload).toHaveBeenCalledWith(
        'wishes-media',
        expect.stringMatching(/^user-id\/.+\.jpg$/),
        file,
      );
      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ media_urls: [newUrl] }),
      );
    });

    it('avec fichier mais status != PENDING : ignore le fichier', async () => {
      const wish = {
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.IN_PROGRESS,
        media_urls: ['https://cdn.example.com/existing.jpg'],
      };
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'new.jpg',
      } as Express.Multer.File;
      wishRepo.findOne.mockResolvedValue(wish);
      wishRepo.save.mockImplementation((w) => Promise.resolve(w));

      await service.update('uuid-1', 'user-id', {}, file);

      expect(supabaseStorage.upload).not.toHaveBeenCalled();
      expect(supabaseStorage.delete).not.toHaveBeenCalled();
    });

    it('avec fichier + PENDING sans ancienne image : upload sans delete', async () => {
      const wish = {
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.PENDING,
        media_urls: [],
      };
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      } as Express.Multer.File;
      supabaseStorage.upload.mockResolvedValue('https://cdn.example.com/photo.jpg');
      wishRepo.findOne.mockResolvedValue(wish);
      wishRepo.save.mockImplementation((w) => Promise.resolve(w));

      await service.update('uuid-1', 'user-id', {}, file);

      expect(supabaseStorage.delete).not.toHaveBeenCalled();
      expect(supabaseStorage.upload).toHaveBeenCalled();
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
        media_urls: [],
      });

      await service.softDelete('uuid-1', 'user-id');

      expect(wishRepo.save).not.toHaveBeenCalled();
      expect(supabaseStorage.delete).not.toHaveBeenCalled();
    });

    it('supprime les médias du bucket avant de passer en CANCELLED', async () => {
      const mediaUrl = 'https://proj.supabase.co/storage/v1/object/public/wishes-media/user-id/photo.jpg';
      wishRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.PENDING,
        media_urls: [mediaUrl],
      });
      supabaseStorage.extractPath.mockReturnValue('user-id/photo.jpg');
      wishRepo.save.mockResolvedValue({});

      await service.softDelete('uuid-1', 'user-id');

      expect(supabaseStorage.extractPath).toHaveBeenCalledWith('wishes-media', mediaUrl);
      expect(supabaseStorage.delete).toHaveBeenCalledWith('wishes-media', ['user-id/photo.jpg']);
      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WishStatus.CANCELLED }),
      );
    });

    it('sans médias — ne tente pas de delete sur le bucket', async () => {
      wishRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        user_id: 'user-id',
        status: WishStatus.PENDING,
        media_urls: [],
      });
      wishRepo.save.mockResolvedValue({});

      await service.softDelete('uuid-1', 'user-id');

      expect(supabaseStorage.delete).not.toHaveBeenCalled();
      expect(wishRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WishStatus.CANCELLED }),
      );
    });
  });
  // --- findCategories() ---

  describe('findCategories()', () => {
    it('retourne les catégories distinctes des souhaits publics, triées', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { category: 'Électronique' },
        { category: 'Vêtements' },
      ]);

      const result = await service.findCategories();

      expect(wishRepo.createQueryBuilder).toHaveBeenCalledWith('wish');
      expect(mockQb.select).toHaveBeenCalledWith('wish.category', 'category');
      expect(mockQb.distinct).toHaveBeenCalledWith(true);
      expect(mockQb.where).toHaveBeenCalledWith(
        'wish.is_private = :isPrivate',
        { isPrivate: false },
      );
      expect(result).toEqual(['Électronique', 'Vêtements']);
    });

    it('retourne un tableau vide si aucun souhait public', async () => {
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.findCategories();

      expect(result).toEqual([]);
    });
  });
});
