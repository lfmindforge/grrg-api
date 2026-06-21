import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventLogService } from './event-log.service';
import { EventLog } from './event-log.entity';
import { User } from '../user/user.entity';
import { EventType } from './event-log.types';

const mockEventRepo = { create: jest.fn(), save: jest.fn() };
const mockUserRepo  = { findOne: jest.fn() };

describe('EventLogService', () => {
  let service: EventLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        { provide: getRepositoryToken(EventLog), useValue: mockEventRepo },
        { provide: getRepositoryToken(User),     useValue: mockUserRepo  },
      ],
    }).compile();
    service = module.get<EventLogService>(EventLogService);
    jest.clearAllMocks();
  });

  describe('log()', () => {
    it('persiste un event avec triggered_by résolu depuis la DB', async () => {
      const actor = { id: 'user-1', pseudo: 'lucas' } as User;
      mockUserRepo.findOne.mockResolvedValue(actor);
      mockEventRepo.create.mockReturnValue({ type: EventType.WISH_CREATE });
      mockEventRepo.save.mockResolvedValue({});

      await service.log(EventType.WISH_CREATE, 'user-1', { wish_id: 'w-1' });

      expect(mockEventRepo.create).toHaveBeenCalledWith({
        type: EventType.WISH_CREATE,
        actor_id: 'user-1',
        payload: { triggered_by: { id: 'user-1', pseudo: 'lucas' }, wish_id: 'w-1' },
      });
      expect(mockEventRepo.save).toHaveBeenCalled();
    });

    it('persiste un event avec triggered_by null si actorId est null', async () => {
      mockEventRepo.create.mockReturnValue({ type: EventType.USER_LOGIN_FAILED });
      mockEventRepo.save.mockResolvedValue({});

      await service.log(EventType.USER_LOGIN_FAILED, null, { email: 'x@x.com' });

      expect(mockUserRepo.findOne).not.toHaveBeenCalled();
      expect(mockEventRepo.create).toHaveBeenCalledWith({
        type: EventType.USER_LOGIN_FAILED,
        actor_id: null,
        payload: { triggered_by: null, email: 'x@x.com' },
      });
    });

    it('persiste avec triggered_by null si le user n\'existe plus en DB', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockEventRepo.create.mockReturnValue({});
      mockEventRepo.save.mockResolvedValue({});

      await service.log(EventType.USER_DELETE, 'ghost-id', {});

      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ triggered_by: null }) }),
      );
    });
  });
});
