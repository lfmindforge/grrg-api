import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationType } from './notification.types';

describe('NotificationService', () => {
  let service: NotificationService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
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

  it('notify() crée la notif et la pousse au client SSE connecté', async () => {
    const notif = { id: 'n1', user_id: 'u1', type: 'grade_up', payload: {}, is_read: false, created_at: new Date() };
    mockRepo.create.mockReturnValue(notif);
    mockRepo.save.mockResolvedValue(notif);

    const subject = service.registerClient('u1');
    const received: unknown[] = [];
    subject.subscribe(e => received.push(e));

    await service.notify('u1', NotificationType.GRADE_UP, { grade: 'lumiere', previous_grade: 'etincelle' });

    expect(mockRepo.save).toHaveBeenCalled();
    expect(received).toHaveLength(1);
  });

  it('findByUser() retourne les 30 dernières notifs et unread_count', async () => {
    const notifs = [
      { id: 'n1', is_read: false },
      { id: 'n2', is_read: true },
    ];
    mockRepo.find.mockResolvedValue(notifs);

    const result = await service.findByUser('u1');

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      order: { created_at: 'DESC' },
      take: 30,
    });
    expect(result.unread_count).toBe(1);
    expect(result.data).toHaveLength(2);
  });

  it('markRead() appelle update avec user_id + notif id', async () => {
    mockRepo.update.mockResolvedValue({ affected: 1 });

    await service.markRead('u1', 'n1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'n1', user_id: 'u1' },
      { is_read: true },
    );
  });

  it('markAllRead() passe toutes les notifs non lues à is_read=true', async () => {
    mockRepo.update.mockResolvedValue({ affected: 3 });

    await service.markAllRead('u1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { user_id: 'u1', is_read: false },
      { is_read: true },
    );
  });

  it('removeClient() complète le subject et le retire du registre', () => {
    const subject = service.registerClient('u1');
    let completed = false;
    subject.subscribe({ complete: () => { completed = true; } });

    service.removeClient('u1', subject);

    expect(completed).toBe(true);
  });
});
