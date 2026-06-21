import { Test, TestingModule } from '@nestjs/testing';
import { EventLogController } from './event-log.controller';
import { EventLogService } from './event-log.service';
import { EventType } from './event-log.types';

const mockEventLogService = {
  findAll: jest.fn(),
};

describe('EventLogController', () => {
  let controller: EventLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventLogController],
      providers: [{ provide: EventLogService, useValue: mockEventLogService }],
    }).compile();
    controller = module.get<EventLogController>(EventLogController);
    jest.clearAllMocks();
  });

  describe('GET /admin/events', () => {
    it('délègue à EventLogService.findAll() et retourne { data, total, page, limit }', async () => {
      const result = { data: [], total: 0, page: 1, limit: 50 };
      mockEventLogService.findAll.mockResolvedValue(result);

      const res = await controller.findAll({});
      expect(mockEventLogService.findAll).toHaveBeenCalledWith({});
      expect(res).toEqual(result);
    });

    it('transmet les filtres type et actor_id', async () => {
      mockEventLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
      const query = { type: EventType.WISH_CREATE, actor_id: 'u-1' };

      await controller.findAll(query);
      expect(mockEventLogService.findAll).toHaveBeenCalledWith(query);
    });
  });
});
