import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(mockRepo as any);
  });

  it('insère une notification en base et la retourne', async () => {
    const payload = { glowAwarded: 20, currentGrade: 'etincelle' };
    const created = {
      id: 'notif-uuid',
      user_id: 'user-1',
      type: 'grade_up',
      payload,
      is_read: false,
      created_at: new Date(),
    };
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    const result = await service.create('user-1', 'grade_up', payload);

    expect(mockRepo.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'grade_up',
      payload,
    });
    expect(mockRepo.save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });
});
