import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { User } from '../user/user.entity';
import { ReactionService } from './reaction.service';
import { NotificationService } from '../notifications/notification.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

const mockReactionRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockWishRepo = {
  findOne: jest.fn(),
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

describe('ReactionService', () => {
  let service: ReactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionService,
        { provide: getRepositoryToken(Reaction), useValue: mockReactionRepo },
        { provide: getRepositoryToken(Wish), useValue: mockWishRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EventLogService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get<ReactionService>(ReactionService);
    jest.clearAllMocks();
  });

  describe('upsert()', () => {
    it('crée une nouvelle réaction si aucune existante', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', user_id: 'owner', is_private: false, title: 'Mon souhait' });
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockReactionRepo.create.mockReturnValue({ user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' });
      mockReactionRepo.save.mockResolvedValue({});
      mockUserRepo.findOne.mockResolvedValue({ pseudo: 'Reacteur' });

      await service.upsert('u-1', 'w-1', { emoji: '❤️' });

      expect(mockReactionRepo.create).toHaveBeenCalledWith({ user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' });
      expect(mockReactionRepo.save).toHaveBeenCalled();
    });

    it("met à jour l'emoji si une réaction existe déjà", async () => {
      const existing = { id: 'r-1', user_id: 'u-1', wish_id: 'w-1', emoji: '👏' };
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', user_id: 'owner', is_private: false, title: 'Mon souhait' });
      mockReactionRepo.findOne.mockResolvedValue(existing);
      mockReactionRepo.save.mockResolvedValue({});

      await service.upsert('u-1', 'w-1', { emoji: '❤️' });

      expect(mockReactionRepo.create).not.toHaveBeenCalled();
      expect(mockReactionRepo.save).toHaveBeenCalledWith({ ...existing, emoji: '❤️' });
    });

    it('lève NotFoundException si le souhait est introuvable ou privé', async () => {
      mockWishRepo.findOne.mockResolvedValue(null);

      await expect(service.upsert('u-1', 'unknown', { emoji: '❤️' })).rejects.toThrow(NotFoundException);
      expect(mockReactionRepo.findOne).not.toHaveBeenCalled();
    });

    it('envoie reaction_received au créateur du souhait sur nouvelle réaction', async () => {
      const REACTOR_ID = 'reactor-uuid';
      const OWNER_ID = 'owner-uuid';
      const wish = { id: 'w1', user_id: OWNER_ID, is_private: false, title: 'Mon souhait' };

      mockWishRepo.findOne.mockResolvedValue(wish);
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockReactionRepo.create.mockReturnValue({ user_id: REACTOR_ID, wish_id: 'w1', emoji: '❤️' });
      mockReactionRepo.save.mockResolvedValue({});
      mockUserRepo.findOne.mockResolvedValue({ pseudo: 'Reacteur' });

      await service.upsert(REACTOR_ID, 'w1', { emoji: '❤️' });

      expect(mockNotificationService.notify).toHaveBeenCalledWith(
        OWNER_ID,
        'reaction_received',
        expect.objectContaining({ reactor_pseudo: 'Reacteur', emoji: '❤️', wish_id: 'w1' }),
      );
    });

    it("n'envoie pas reaction_received si mise à jour d'une réaction existante", async () => {
      const REACTOR_ID = 'reactor-uuid';
      const wish = { id: 'w1', user_id: 'owner-uuid', is_private: false, title: 'Mon souhait' };
      const existing = { user_id: REACTOR_ID, wish_id: 'w1', emoji: '👍' };

      mockWishRepo.findOne.mockResolvedValue(wish);
      mockReactionRepo.findOne.mockResolvedValue(existing);
      mockReactionRepo.save.mockResolvedValue({});

      await service.upsert(REACTOR_ID, 'w1', { emoji: '❤️' });

      expect(mockNotificationService.notify).not.toHaveBeenCalled();
    });

    it("n'envoie pas reaction_received si le réacteur est le créateur du souhait", async () => {
      const OWNER_ID = 'owner-uuid';
      const wish = { id: 'w1', user_id: OWNER_ID, is_private: false, title: 'Mon souhait' };

      mockWishRepo.findOne.mockResolvedValue(wish);
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockReactionRepo.create.mockReturnValue({ user_id: OWNER_ID, wish_id: 'w1', emoji: '❤️' });
      mockReactionRepo.save.mockResolvedValue({});

      await service.upsert(OWNER_ID, 'w1', { emoji: '❤️' });

      expect(mockNotificationService.notify).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('supprime la réaction existante', async () => {
      const reaction = { id: 'r-1', user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' };
      mockReactionRepo.findOne.mockResolvedValue(reaction);
      mockReactionRepo.remove.mockResolvedValue(undefined);

      await service.delete('u-1', 'w-1');

      expect(mockReactionRepo.remove).toHaveBeenCalledWith(reaction);
    });

    it('lève NotFoundException si aucune réaction trouvée', async () => {
      mockReactionRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('u-1', 'w-1')).rejects.toThrow(NotFoundException);
      expect(mockReactionRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('getMyReaction()', () => {
    it("retourne l'emoji si une réaction existe", async () => {
      mockReactionRepo.findOne.mockResolvedValue({ emoji: '❤️' });

      const result = await service.getMyReaction('u-1', 'w-1');

      expect(result).toEqual({ emoji: '❤️' });
    });

    it('retourne { emoji: null } si aucune réaction', async () => {
      mockReactionRepo.findOne.mockResolvedValue(null);

      const result = await service.getMyReaction('u-1', 'w-1');

      expect(result).toEqual({ emoji: null });
    });
  });

  // --- événements ---

  describe('événements EventLog', () => {
    it('log REACTION_UPSERT (action: create) pour une nouvelle réaction', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', user_id: 'owner', is_private: false, title: 'Mon souhait' });
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockReactionRepo.create.mockReturnValue({});
      mockReactionRepo.save.mockResolvedValue({});
      mockUserRepo.findOne.mockResolvedValue({ pseudo: 'alice' });

      await service.upsert('u-1', 'w-1', { emoji: '❤️' });

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.REACTION_UPSERT,
        'u-1',
        expect.objectContaining({ wish_id: 'w-1', emoji: '❤️', action: 'create' }),
      );
    });

    it('log REACTION_UPSERT (action: update) pour une réaction existante', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', user_id: 'owner', is_private: false, title: 'Mon souhait' });
      mockReactionRepo.findOne.mockResolvedValue({ user_id: 'u-1', wish_id: 'w-1', emoji: '👍' });
      mockReactionRepo.save.mockResolvedValue({});

      await service.upsert('u-1', 'w-1', { emoji: '❤️' });

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.REACTION_UPSERT,
        'u-1',
        expect.objectContaining({ wish_id: 'w-1', emoji: '❤️', action: 'update' }),
      );
    });

    it('log REACTION_DELETE avant le remove', async () => {
      mockReactionRepo.findOne.mockResolvedValue({ user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' });
      mockReactionRepo.remove.mockResolvedValue(undefined);

      await service.delete('u-1', 'w-1');

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.REACTION_DELETE,
        'u-1',
        expect.objectContaining({ wish_id: 'w-1' }),
      );
    });
  });
});
