import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Reaction } from './reaction.entity';
import { Wish } from '../wish/wish.entity';
import { ReactionService } from './reaction.service';

const mockReactionRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockWishRepo = {
  findOne: jest.fn(),
};

describe('ReactionService', () => {
  let service: ReactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionService,
        { provide: getRepositoryToken(Reaction), useValue: mockReactionRepo },
        { provide: getRepositoryToken(Wish), useValue: mockWishRepo },
      ],
    }).compile();

    service = module.get<ReactionService>(ReactionService);
    jest.clearAllMocks();
  });

  describe('upsert()', () => {
    it('crée une nouvelle réaction si aucune existante', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', is_private: false });
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockReactionRepo.create.mockReturnValue({ user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' });
      mockReactionRepo.save.mockResolvedValue({});

      await service.upsert('u-1', 'w-1', { emoji: '❤️' });

      expect(mockReactionRepo.create).toHaveBeenCalledWith({ user_id: 'u-1', wish_id: 'w-1', emoji: '❤️' });
      expect(mockReactionRepo.save).toHaveBeenCalled();
    });

    it("met à jour l'emoji si une réaction existe déjà", async () => {
      const existing = { id: 'r-1', user_id: 'u-1', wish_id: 'w-1', emoji: '👏' };
      mockWishRepo.findOne.mockResolvedValue({ id: 'w-1', is_private: false });
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
});
