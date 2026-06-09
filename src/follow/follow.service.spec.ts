import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Follow } from './follow.entity';
import { User } from '../user/user.entity';
import { FollowService } from './follow.service';
import { NotificationService } from '../notifications/notification.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

const mockDataSource = {
  query: jest.fn(),
};

const mockFollowRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockNotificationService = {
  notify: jest.fn().mockResolvedValue(undefined),
};

const mockEventService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('FollowService', () => {
  let service: FollowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        { provide: getRepositoryToken(Follow), useValue: mockFollowRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EventLogService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
    jest.clearAllMocks();
  });

  describe('follow()', () => {
    it('suit un utilisateur', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'followed-id' });
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue({ follower_id: 'follower-id', followed_id: 'followed-id' });
      mockFollowRepo.save.mockResolvedValue(undefined);

      await service.follow('follower-id', 'followed-id');

      expect(mockFollowRepo.save).toHaveBeenCalled();
    });

    it('lève BadRequestException si on tente de se suivre soi-même', async () => {
      await expect(service.follow('user-id', 'user-id')).rejects.toThrow(BadRequestException);
      expect(mockFollowRepo.save).not.toHaveBeenCalled();
    });

    it("lève NotFoundException si l'utilisateur cible n'existe pas", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.follow('follower-id', 'unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('lève ConflictException si déjà suivi', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'followed-id' });
      mockFollowRepo.findOne.mockResolvedValue({ follower_id: 'follower-id', followed_id: 'followed-id' });
      await expect(service.follow('follower-id', 'followed-id')).rejects.toThrow(ConflictException);
      expect(mockFollowRepo.save).not.toHaveBeenCalled();
    });

    it('envoie new_follower au suivi avec le pseudo du follower', async () => {
      const FOLLOWER_ID = 'follower-uuid';
      const FOLLOWED_ID = 'followed-uuid';

      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: FOLLOWED_ID, pseudo: 'Suivi' })
        .mockResolvedValueOnce({ id: FOLLOWER_ID, pseudo: 'Follower' });
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue({});
      mockFollowRepo.save.mockResolvedValue({});

      await service.follow(FOLLOWER_ID, FOLLOWED_ID);

      expect(mockNotificationService.notify).toHaveBeenCalledWith(
        FOLLOWED_ID,
        'new_follower',
        expect.objectContaining({ follower_pseudo: 'Follower', follower_id: FOLLOWER_ID }),
      );
    });
  });

  describe('unfollow()', () => {
    it('cesse de suivre un utilisateur', async () => {
      const follow = { follower_id: 'follower-id', followed_id: 'followed-id' };
      mockFollowRepo.findOne.mockResolvedValue(follow);
      mockFollowRepo.remove.mockResolvedValue(undefined);

      await service.unfollow('follower-id', 'followed-id');

      expect(mockFollowRepo.remove).toHaveBeenCalledWith(follow);
    });

    it('lève NotFoundException si relation de suivi inexistante', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);
      await expect(service.unfollow('follower-id', 'followed-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('countFollowers()', () => {
    it('retourne le nombre de followers', async () => {
      mockFollowRepo.count.mockResolvedValue(7);
      const result = await service.countFollowers('user-id');
      expect(result).toBe(7);
      expect(mockFollowRepo.count).toHaveBeenCalledWith({ where: { followed_id: 'user-id' } });
    });
  });

  describe('countFollowing()', () => {
    it('retourne le nombre de following', async () => {
      mockFollowRepo.count.mockResolvedValue(3);
      const result = await service.countFollowing('user-id');
      expect(result).toBe(3);
      expect(mockFollowRepo.count).toHaveBeenCalledWith({ where: { follower_id: 'user-id' } });
    });
  });

  describe('getFollowers()', () => {
    it('retourne la liste des followers', async () => {
      const followers = [
        { id: 'user-2', pseudo: 'alice', avatar_url: null, grade: 'lumiere', glow_points: 20 },
      ];
      mockDataSource.query.mockResolvedValue(followers);

      const result = await service.getFollowers('user-1');

      expect(result).toEqual(followers);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), ['user-1']);
    });

    it('retourne un tableau vide si aucun follower', async () => {
      mockDataSource.query.mockResolvedValue([]);
      const result = await service.getFollowers('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getFollowing()', () => {
    it('retourne la liste des utilisateurs suivis', async () => {
      const following = [
        { id: 'user-3', pseudo: 'bob', avatar_url: null, grade: 'eclat', glow_points: 50 },
      ];
      mockDataSource.query.mockResolvedValue(following);

      const result = await service.getFollowing('user-1');

      expect(result).toEqual(following);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), ['user-1']);
    });

    it('retourne un tableau vide si aucun suivi', async () => {
      mockDataSource.query.mockResolvedValue([]);
      const result = await service.getFollowing('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('isFollowing()', () => {
    it('retourne true si la relation de suivi existe', async () => {
      mockFollowRepo.findOne.mockResolvedValue({ follower_id: 'user-1', followed_id: 'user-2' });
      const result = await service.isFollowing('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('retourne false si la relation est absente', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);
      const result = await service.isFollowing('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });

  describe('getSuggestions()', () => {
    it('retourne des utilisateurs à suivre', async () => {
      const suggestions = [
        { id: 'user-2', pseudo: 'bob', avatar_url: null, grade: 'lumiere', glow_points: 50 },
      ];
      mockDataSource.query.mockResolvedValue(suggestions);

      const result = await service.getSuggestions('user-1');

      expect(result).toEqual(suggestions);
    });

    it('passe le userId en paramètre de la requête', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.getSuggestions('user-1');

      expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), ['user-1']);
    });
  });

  // --- événements ---

  describe('événements EventLog', () => {
    it('log FOLLOW_CREATE après le save', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({ id: 'followed-id' }).mockResolvedValueOnce({ id: 'follower-id', pseudo: 'alice' });
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue({});
      mockFollowRepo.save.mockResolvedValue(undefined);

      await service.follow('follower-id', 'followed-id');

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.FOLLOW_CREATE,
        'follower-id',
        expect.objectContaining({ followed_id: 'followed-id' }),
      );
    });

    it('log FOLLOW_DELETE avant le remove', async () => {
      mockFollowRepo.findOne.mockResolvedValue({ follower_id: 'follower-id', followed_id: 'followed-id' });
      mockFollowRepo.remove.mockResolvedValue(undefined);

      await service.unfollow('follower-id', 'followed-id');

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.FOLLOW_DELETE,
        'follower-id',
        expect.objectContaining({ followed_id: 'followed-id' }),
      );
    });
  });
});
