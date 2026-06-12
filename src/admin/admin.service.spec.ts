import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { AdminService } from './admin.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';
import { MailService } from '../mail/mail.service';

const mockQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockUserRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockWishRepo    = { findOne: jest.fn(), softRemove: jest.fn() };
const mockCommentRepo = { findOne: jest.fn(), softRemove: jest.fn() };
const mockEventService = { log: jest.fn().mockResolvedValue(undefined) };
const mockMailService  = { sendMail: jest.fn().mockResolvedValue(undefined) };

const ADMIN_ID   = 'admin-uuid';
const USER_ID    = 'user-uuid';
const WISH_ID    = 'wish-uuid';
const COMMENT_ID = 'comment-uuid';

const baseUser = { id: USER_ID, pseudo: 'alice', email: 'alice@example.com', banned_until: null };

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User),    useValue: mockUserRepo },
        { provide: getRepositoryToken(Wish),    useValue: mockWishRepo },
        { provide: getRepositoryToken(Comment), useValue: mockCommentRepo },
        { provide: EventLogService,             useValue: mockEventService },
        { provide: MailService,                 useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQb);
  });

  // ─── searchUsers ────────────────────────────────────────────────────────────

  describe('searchUsers()', () => {
    it("retourne les utilisateurs dont le pseudo contient la recherche", async () => {
      mockQb.getMany.mockResolvedValue([baseUser]);

      const result = await service.searchUsers('alice');

      expect(result).toHaveLength(1);
      expect(mockQb.where).toHaveBeenCalledWith('u.pseudo ILIKE :q', { q: '%alice%' });
    });

    it("retourne jusqu'à 20 utilisateurs pour une recherche vide", async () => {
      mockQb.getMany.mockResolvedValue([baseUser]);

      await service.searchUsers('');

      expect(mockQb.limit).toHaveBeenCalledWith(20);
    });
  });

  // ─── banUser ────────────────────────────────────────────────────────────────

  describe('banUser()', () => {
    it('met à jour banned_until, log ADMIN_BAN et envoie un email', async () => {
      mockUserRepo.findOne.mockResolvedValue(baseUser);
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.banUser(ADMIN_ID, USER_ID, { until: '2026-12-31', reason: 'Comportement abusif' });

      expect(mockUserRepo.update).toHaveBeenCalledWith(USER_ID, { banned_until: new Date('2026-12-31') });
      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.ADMIN_BAN,
        ADMIN_ID,
        expect.objectContaining({ target_user_id: USER_ID, reason: 'Comportement abusif' }),
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        baseUser.email,
        expect.stringContaining('suspendu'),
        expect.any(String),
      );
    });

    it("lève NotFoundException si l'utilisateur est introuvable", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.banUser(ADMIN_ID, 'unknown', { until: '2026-12-31', reason: 'Test' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('envoie un email mentionnant "définitivement" pour un ban permanent', async () => {
      mockUserRepo.findOne.mockResolvedValue(baseUser);
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.banUser(ADMIN_ID, USER_ID, { until: '9999-12-31', reason: 'Récidive grave' });

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        baseUser.email,
        expect.any(String),
        expect.stringContaining('définitivement'),
      );
    });
  });

  // ─── unbanUser ──────────────────────────────────────────────────────────────

  describe('unbanUser()', () => {
    it('remet banned_until à null, log ADMIN_UNBAN et envoie un email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...baseUser, banned_until: new Date('2026-12-31') });
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.unbanUser(ADMIN_ID, USER_ID);

      expect(mockUserRepo.update).toHaveBeenCalledWith(USER_ID, { banned_until: null });
      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.ADMIN_UNBAN,
        ADMIN_ID,
        expect.objectContaining({ target_user_id: USER_ID }),
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        baseUser.email,
        expect.stringContaining('rétabli'),
        expect.any(String),
      );
    });

    it("lève NotFoundException si l'utilisateur est introuvable", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.unbanUser(ADMIN_ID, 'unknown')).rejects.toThrow(NotFoundException);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteContent ──────────────────────────────────────────────────────────

  describe('deleteContent()', () => {
    it('soft-supprime un souhait et log ADMIN_CONTENT_DELETE', async () => {
      const wish = { id: WISH_ID };
      mockWishRepo.findOne.mockResolvedValue(wish);
      mockWishRepo.softRemove.mockResolvedValue(undefined);

      await service.deleteContent(ADMIN_ID, 'wish', WISH_ID);

      expect(mockWishRepo.softRemove).toHaveBeenCalledWith(wish);
      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.ADMIN_CONTENT_DELETE,
        ADMIN_ID,
        expect.objectContaining({ target_type: 'wish', target_id: WISH_ID }),
      );
    });

    it('soft-supprime un commentaire et log ADMIN_CONTENT_DELETE', async () => {
      const comment = { id: COMMENT_ID };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.softRemove.mockResolvedValue(undefined);

      await service.deleteContent(ADMIN_ID, 'comment', COMMENT_ID);

      expect(mockCommentRepo.softRemove).toHaveBeenCalledWith(comment);
      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.ADMIN_CONTENT_DELETE,
        ADMIN_ID,
        expect.objectContaining({ target_type: 'comment', target_id: COMMENT_ID }),
      );
    });

    it('lève NotFoundException si le souhait est introuvable', async () => {
      mockWishRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteContent(ADMIN_ID, 'wish', 'unknown')).rejects.toThrow(NotFoundException);
      expect(mockWishRepo.softRemove).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le commentaire est introuvable', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteContent(ADMIN_ID, 'comment', 'unknown')).rejects.toThrow(NotFoundException);
      expect(mockCommentRepo.softRemove).not.toHaveBeenCalled();
    });
  });
});
