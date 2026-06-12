import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Report, ReportReason, ReportTargetType } from './report.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { User } from '../user/user.entity';
import { ReportService } from './report.service';
import { EventLogService } from '../event-log/event-log.service';
import { EventType } from '../event-log/event-log.types';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockReportRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockWishRepo    = { findOne: jest.fn(), find: jest.fn() };
const mockCommentRepo = { findOne: jest.fn(), find: jest.fn() };
const mockUserRepo    = { find: jest.fn() };
const mockEventService = { log: jest.fn().mockResolvedValue(undefined) };

const REPORTER_ID = 'reporter-uuid';
const OWNER_ID    = 'owner-uuid';
const WISH_ID     = 'wish-uuid';
const COMMENT_ID  = 'comment-uuid';

const baseWish    = { id: WISH_ID,    user_id: OWNER_ID };
const baseComment = { id: COMMENT_ID, user_id: OWNER_ID };

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(Report),  useValue: mockReportRepo },
        { provide: getRepositoryToken(Wish),    useValue: mockWishRepo },
        { provide: getRepositoryToken(Comment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(User),    useValue: mockUserRepo },
        { provide: EventLogService,             useValue: mockEventService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    jest.clearAllMocks();
    mockReportRepo.createQueryBuilder.mockReturnValue(mockQb);
  });

  // ─── createReport ───────────────────────────────────────────────────────────

  describe('createReport()', () => {
    it('crée un signalement pour un souhait valide', async () => {
      const saved = { id: 'r-1', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM, details: null, created_at: new Date() };
      mockWishRepo.findOne.mockResolvedValue(baseWish);
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.create.mockReturnValue(saved);
      mockReportRepo.save.mockResolvedValue(saved);

      const result = await service.createReport(REPORTER_ID, {
        target_type: ReportTargetType.WISH,
        target_id: WISH_ID,
        reason: ReportReason.SPAM,
      });

      expect(result.id).toBe('r-1');
      expect(result.target_type).toBe(ReportTargetType.WISH);
      expect(result.content_author).toBeNull();
    });

    it('crée un signalement pour un commentaire valide', async () => {
      const saved = { id: 'r-2', reporter_id: REPORTER_ID, target_type: ReportTargetType.COMMENT, target_id: COMMENT_ID, reason: ReportReason.HARASSMENT, details: null, created_at: new Date() };
      mockCommentRepo.findOne.mockResolvedValue(baseComment);
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.create.mockReturnValue(saved);
      mockReportRepo.save.mockResolvedValue(saved);

      const result = await service.createReport(REPORTER_ID, {
        target_type: ReportTargetType.COMMENT,
        target_id: COMMENT_ID,
        reason: ReportReason.HARASSMENT,
      });

      expect(result.target_type).toBe(ReportTargetType.COMMENT);
    });

    it('lève NotFoundException si le souhait est introuvable', async () => {
      mockWishRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReport(REPORTER_ID, { target_type: ReportTargetType.WISH, target_id: 'unknown', reason: ReportReason.SPAM }),
      ).rejects.toThrow(NotFoundException);
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le commentaire est introuvable', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReport(REPORTER_ID, { target_type: ReportTargetType.COMMENT, target_id: 'unknown', reason: ReportReason.SPAM }),
      ).rejects.toThrow(NotFoundException);
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si le reporter est le propriétaire du souhait", async () => {
      mockWishRepo.findOne.mockResolvedValue({ ...baseWish, user_id: REPORTER_ID });

      await expect(
        service.createReport(REPORTER_ID, { target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si le reporter est l'auteur du commentaire", async () => {
      mockCommentRepo.findOne.mockResolvedValue({ ...baseComment, user_id: REPORTER_ID });

      await expect(
        service.createReport(REPORTER_ID, { target_type: ReportTargetType.COMMENT, target_id: COMMENT_ID, reason: ReportReason.SPAM }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le contenu a déjà été signalé par cet utilisateur', async () => {
      mockWishRepo.findOne.mockResolvedValue(baseWish);
      mockReportRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createReport(REPORTER_ID, { target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM }),
      ).rejects.toThrow(ConflictException);
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });

    it('sauvegarde les details quand fournis', async () => {
      const saved = { id: 'r-3', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.OTHER, details: 'Contenu problématique', created_at: new Date() };
      mockWishRepo.findOne.mockResolvedValue(baseWish);
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.create.mockReturnValue(saved);
      mockReportRepo.save.mockResolvedValue(saved);

      const result = await service.createReport(REPORTER_ID, {
        target_type: ReportTargetType.WISH,
        target_id: WISH_ID,
        reason: ReportReason.OTHER,
        details: 'Contenu problématique',
      });

      expect(result.details).toBe('Contenu problématique');
    });

    it('enregistre details à null quand absent', async () => {
      const saved = { id: 'r-4', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM, details: null, created_at: new Date() };
      mockWishRepo.findOne.mockResolvedValue(baseWish);
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.create.mockReturnValue(saved);
      mockReportRepo.save.mockResolvedValue(saved);

      const result = await service.createReport(REPORTER_ID, {
        target_type: ReportTargetType.WISH,
        target_id: WISH_ID,
        reason: ReportReason.SPAM,
      });

      expect(result.details).toBeNull();
    });

    it('log REPORT_CREATE après la sauvegarde', async () => {
      const saved = { id: 'r-5', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.MISLEADING, details: null, created_at: new Date() };
      mockWishRepo.findOne.mockResolvedValue(baseWish);
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.create.mockReturnValue(saved);
      mockReportRepo.save.mockResolvedValue(saved);

      await service.createReport(REPORTER_ID, {
        target_type: ReportTargetType.WISH,
        target_id: WISH_ID,
        reason: ReportReason.MISLEADING,
      });

      expect(mockEventService.log).toHaveBeenCalledWith(
        EventType.REPORT_CREATE,
        REPORTER_ID,
        expect.objectContaining({ target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.MISLEADING }),
      );
    });
  });

  // ─── getReports ─────────────────────────────────────────────────────────────

  describe('getReports()', () => {
    it('retourne une liste paginée sans filtre', async () => {
      const report = { id: 'r-1', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM, details: null, created_at: new Date() };
      mockQb.getManyAndCount.mockResolvedValue([[report], 1]);
      mockWishRepo.find.mockResolvedValue([]);
      mockCommentRepo.find.mockResolvedValue([]);
      mockUserRepo.find.mockResolvedValue([]);

      const result = await service.getReports({});

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('r-1');
      expect(result.data[0].content_author).toBeNull();
      expect(mockQb.where).not.toHaveBeenCalled();
    });

    it('résout content_author depuis les entités liées', async () => {
      const report = { id: 'r-1', reporter_id: REPORTER_ID, target_type: ReportTargetType.WISH, target_id: WISH_ID, reason: ReportReason.SPAM, details: null, created_at: new Date() };
      mockQb.getManyAndCount.mockResolvedValue([[report], 1]);
      mockWishRepo.find.mockResolvedValue([{ id: WISH_ID, user_id: OWNER_ID }]);
      mockCommentRepo.find.mockResolvedValue([]);
      mockUserRepo.find.mockResolvedValue([{ id: OWNER_ID, pseudo: 'alice' }]);

      const result = await service.getReports({});

      expect(result.data[0].content_author).toEqual({ id: OWNER_ID, pseudo: 'alice' });
    });

    it('applique le filtre target_type=wish', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      mockWishRepo.find.mockResolvedValue([]);
      mockCommentRepo.find.mockResolvedValue([]);
      mockUserRepo.find.mockResolvedValue([]);

      await service.getReports({ target_type: ReportTargetType.WISH });

      expect(mockQb.where).toHaveBeenCalledWith('report.target_type = :type', { type: ReportTargetType.WISH });
    });

    it('respecte la pagination page=2 limit=5', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      mockWishRepo.find.mockResolvedValue([]);
      mockCommentRepo.find.mockResolvedValue([]);
      mockUserRepo.find.mockResolvedValue([]);

      const result = await service.getReports({ page: 2, limit: 5 });

      expect(mockQb.skip).toHaveBeenCalledWith(5);
      expect(mockQb.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });
});
