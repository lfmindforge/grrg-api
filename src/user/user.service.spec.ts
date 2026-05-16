import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { Wish } from '../wish/wish.entity';
import { UserService } from './user.service';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';
import { WishStatus } from '../wish/wish.types';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockWishRepo = {
  find: jest.fn(),
};

const mockStorage = {
  upload: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
  extractPath: jest.fn().mockReturnValue('user-id/old-avatar.jpg'),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Wish), useValue: mockWishRepo },
        { provide: SupabaseStorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: { getOrThrow: () => 'avatars' } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  // --- findByEmail ---

  describe('findByEmail', () => {
    it('retourne le user si email trouvé', async () => {
      const user = { id: 'uuid', email: 'test@test.com' } as User;
      mockUserRepo.findOne.mockResolvedValue(user);
      const result = await service.findByEmail('test@test.com');
      expect(result).toEqual(user);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('retourne null si email non trouvé', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('inconnu@test.com');
      expect(result).toBeNull();
    });
  });

  // --- findByPseudo ---

  describe('findByPseudo', () => {
    it('retourne le user si pseudo trouvé', async () => {
      const user = { id: 'uuid', pseudo: 'monpseudo' } as User;
      mockUserRepo.findOne.mockResolvedValue(user);
      const result = await service.findByPseudo('monpseudo');
      expect(result).toEqual(user);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { pseudo: 'monpseudo' },
      });
    });

    it('retourne null si pseudo non trouvé', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.findByPseudo('inconnu');
      expect(result).toBeNull();
    });
  });

  // --- create ---

  describe('create', () => {
    it('crée et retourne le user', async () => {
      const data = {
        email: 'new@test.com',
        password_hash: 'hashed',
        pseudo: 'newuser',
        birthdate: new Date('1995-06-15'),
      };
      const saved = { id: 'uuid', ...data } as User;
      mockUserRepo.create.mockReturnValue(data);
      mockUserRepo.save.mockResolvedValue(saved);
      const result = await service.create(data);
      expect(mockUserRepo.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(saved);
    });
  });

  // --- findByOAuthId ---

  describe('findByOAuthId', () => {
    it('retourne le user si provider + oauthId trouvés', async () => {
      const user = {
        id: 'uuid',
        oauth_provider: 'google',
        oauth_id: '123',
      } as User;
      mockUserRepo.findOne.mockResolvedValue(user);
      const result = await service.findByOAuthId('google', '123');
      expect(result).toEqual(user);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { oauth_provider: 'google', oauth_id: '123' },
      });
    });

    it('retourne null si non trouvé', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.findByOAuthId('google', 'inexistant');
      expect(result).toBeNull();
    });
  });

  // --- getProfile() ---

  describe('getProfile()', () => {
    const mockUser: Partial<User> = {
      id: 'user-id',
      pseudo: 'alice',
      avatar_url: null,
      grade: 'etincelle',
      glow_points: 0,
    };

    it('retourne le profil complet avec badges:[] et donations_count:0', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockWishRepo.find.mockResolvedValue([]);

      const result = await service.getProfile('user-id');

      expect(result).toEqual({
        id: 'user-id',
        pseudo: 'alice',
        avatar_url: null,
        grade: 'etincelle',
        glow_points: 0,
        badges: [],
        donations_count: 0,
        gallery: [],
      });
    });

    it('lève NotFoundException si user introuvable', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('uuid-inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('la galerie exclut les souhaits privés', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockWishRepo.find.mockResolvedValue([]);

      await service.getProfile('user-id');

      expect(mockWishRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_private: false }),
        }),
      );
    });

    it('la galerie filtre par user_id', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockWishRepo.find.mockResolvedValue([]);

      await service.getProfile('user-id');

      expect(mockWishRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'user-id' }),
        }),
      );
    });

    it('cover = media_urls[0] si présent, null sinon', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockWishRepo.find.mockResolvedValue([
        {
          id: 'wish-1',
          title: 'Avec média',
          media_urls: ['https://cdn.example.com/photo.jpg'],
          status: WishStatus.PENDING,
        },
        {
          id: 'wish-2',
          title: 'Sans média',
          media_urls: [],
          status: WishStatus.PENDING,
        },
      ]);

      const result = await service.getProfile('user-id');

      expect(result.gallery).toEqual([
        {
          id: 'wish-1',
          title: 'Avec média',
          cover: 'https://cdn.example.com/photo.jpg',
          status: WishStatus.PENDING,
        },
        {
          id: 'wish-2',
          title: 'Sans média',
          cover: null,
          status: WishStatus.PENDING,
        },
      ]);
    });
  });

  // --- updateMe() ---

  describe('updateMe()', () => {
    let existingUser: User;

    beforeEach(() => {
      existingUser = {
        id: 'user-id',
        pseudo: 'alice',
        avatar_url: null,
        grade: 'etincelle',
        glow_points: 0,
      } as unknown as User;
    });

    it('met à jour pseudo si fourni et disponible', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...existingUser, pseudo: 'nouveau' });
      mockUserRepo.save.mockResolvedValue({
        ...existingUser,
        pseudo: 'nouveau',
      });
      mockWishRepo.find.mockResolvedValue([]);

      const result = await service.updateMe('user-id', { pseudo: 'nouveau' });

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ pseudo: 'nouveau' }),
      );
      expect(result.pseudo).toBe('nouveau');
    });

    it('lève ConflictException si pseudo déjà pris par un autre user', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ id: 'autre-user', pseudo: 'bob' });

      await expect(
        service.updateMe('user-id', { pseudo: 'bob' }),
      ).rejects.toThrow(ConflictException);
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('pseudo identique à actuel → pas de ConflictException, sauvegarde quand même', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(existingUser);
      mockUserRepo.save.mockResolvedValue(existingUser);
      mockWishRepo.find.mockResolvedValue([]);

      await expect(
        service.updateMe('user-id', { pseudo: 'alice' }),
      ).resolves.not.toThrow();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('upload avatar vers Supabase et met à jour avatar_url', async () => {
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
      } as Express.Multer.File;
      const avatarUrl = 'https://cdn.supabase.co/avatars/user-id/avatar.jpg';
      mockStorage.upload.mockResolvedValue(avatarUrl);
      mockUserRepo.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ ...existingUser, avatar_url: avatarUrl });
      mockUserRepo.save.mockResolvedValue({
        ...existingUser,
        avatar_url: avatarUrl,
      });
      mockWishRepo.find.mockResolvedValue([]);

      const result = await service.updateMe('user-id', {}, file);

      expect(mockStorage.upload).toHaveBeenCalledWith(
        'avatars',
        expect.stringMatching(/^user-id\/.+\.jpg$/),
        file,
      );
      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_url: avatarUrl }),
      );
      expect(result.avatar_url).toBe(avatarUrl);
    });

    it("supprime l'ancien avatar avant d'uploader le nouveau", async () => {
      const userWithAvatar = {
        ...existingUser,
        avatar_url: 'https://cdn.supabase.co/storage/v1/object/public/avatars/user-id/old-avatar.jpg',
      };
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'new.jpg',
      } as Express.Multer.File;
      const newUrl = 'https://cdn.supabase.co/avatars/user-id/new.jpg';
      mockStorage.upload.mockResolvedValue(newUrl);
      mockStorage.extractPath.mockReturnValue('user-id/old-avatar.jpg');
      mockUserRepo.findOne
        .mockResolvedValueOnce(userWithAvatar)
        .mockResolvedValueOnce({ ...userWithAvatar, avatar_url: newUrl });
      mockUserRepo.save.mockResolvedValue({ ...userWithAvatar, avatar_url: newUrl });
      mockWishRepo.find.mockResolvedValue([]);

      await service.updateMe('user-id', {}, file);

      expect(mockStorage.delete).toHaveBeenCalledWith('avatars', ['user-id/old-avatar.jpg']);
      expect(mockStorage.upload).toHaveBeenCalled();
    });

    it('sans pseudo ni fichier → sauvegarde et retourne profil inchangé', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(existingUser);
      mockUserRepo.save.mockResolvedValue(existingUser);
      mockWishRepo.find.mockResolvedValue([]);

      const result = await service.updateMe('user-id', {});

      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(result.pseudo).toBe('alice');
    });
  });
});
