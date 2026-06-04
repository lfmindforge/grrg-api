import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Comment } from './comment.entity';
import { Wish } from '../wish/wish.entity';
import { CommentService } from './comment.service';

const mockQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockCommentRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockWishRepo = {
  findOne: jest.fn(),
};

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getRepositoryToken(Comment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(Wish), useValue: mockWishRepo },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    jest.clearAllMocks();
    mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);
  });

  describe('getComments()', () => {
    it('retourne une liste paginée de commentaires pour un souhait existant', async () => {
      const wish = { id: 'wish-1', is_private: false };
      const comment = {
        id: 'c-1',
        wish_id: 'wish-1',
        content: 'Super souhait !',
        is_reported: false,
        created_at: new Date('2026-01-01'),
        user: { id: 'u-1', pseudo: 'alice', avatar_url: null, grade: 'etincelle' },
      };
      mockWishRepo.findOne.mockResolvedValue(wish);
      mockQb.getManyAndCount.mockResolvedValue([[comment], 1]);

      const result = await service.getComments('wish-1', { page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0]).toMatchObject({
        id: 'c-1',
        content: 'Super souhait !',
        author: { id: 'u-1', pseudo: 'alice', grade: 'etincelle' },
      });
    });

    it('applique la pagination : page=2, limit=5 → skip=5, take=5', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'wish-1', is_private: false });
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.getComments('wish-1', { page: 2, limit: 5 });

      expect(mockQb.skip).toHaveBeenCalledWith(5);
      expect(mockQb.take).toHaveBeenCalledWith(5);
    });

    it('lève NotFoundException si le souhait est introuvable ou privé', async () => {
      mockWishRepo.findOne.mockResolvedValue(null);

      await expect(service.getComments('unknown', {})).rejects.toThrow(NotFoundException);
      expect(mockCommentRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('utilise les valeurs par défaut page=1, limit=10', async () => {
      mockWishRepo.findOne.mockResolvedValue({ id: 'wish-1', is_private: false });
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.getComments('wish-1', {});

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('addComment()', () => {
    it('crée et retourne un commentaire avec les données auteur', async () => {
      const wish = { id: 'wish-1', is_private: false };
      const saved = { id: 'c-new' };
      const full = {
        id: 'c-new',
        wish_id: 'wish-1',
        content: 'Génial !',
        is_reported: false,
        created_at: new Date(),
        user: { id: 'u-1', pseudo: 'alice', avatar_url: null, grade: 'etincelle' },
      };

      mockWishRepo.findOne.mockResolvedValue(wish);
      mockCommentRepo.create.mockReturnValue(saved);
      mockCommentRepo.save.mockResolvedValue(saved);
      mockCommentRepo.findOne.mockResolvedValue(full);

      const result = await service.addComment('u-1', 'wish-1', { content: 'Génial !' });

      expect(mockCommentRepo.create).toHaveBeenCalledWith({
        user_id: 'u-1',
        wish_id: 'wish-1',
        content: 'Génial !',
      });
      expect(result.author.pseudo).toBe('alice');
    });

    it('lève NotFoundException si le souhait est introuvable', async () => {
      mockWishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addComment('u-1', 'unknown', { content: 'test' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockCommentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment()', () => {
    it("supprime le commentaire si l'utilisateur en est l'auteur", async () => {
      const comment = { id: 'c-1', user_id: 'u-1', content: 'test' };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.remove.mockResolvedValue(undefined);

      await service.deleteComment('u-1', 'c-1');

      expect(mockCommentRepo.remove).toHaveBeenCalledWith(comment);
    });

    it('lève NotFoundException si le commentaire est introuvable', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteComment('u-1', 'unknown')).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si l'utilisateur n'est pas l'auteur", async () => {
      mockCommentRepo.findOne.mockResolvedValue({ id: 'c-1', user_id: 'u-other' });

      await expect(service.deleteComment('u-1', 'c-1')).rejects.toThrow(ForbiddenException);
      expect(mockCommentRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('reportComment()', () => {
    it('passe is_reported à true', async () => {
      const comment = { id: 'c-1', user_id: 'u-other', is_reported: false };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.save.mockResolvedValue({ ...comment, is_reported: true });

      await service.reportComment('u-1', 'c-1');

      expect(mockCommentRepo.save).toHaveBeenCalledWith({ ...comment, is_reported: true });
    });

    it('lève NotFoundException si le commentaire est introuvable', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.reportComment('u-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
