import { Subject } from 'rxjs';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: {
    findByUser: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
    registerClient: jest.Mock;
    removeClient: jest.Mock;
  };

  beforeEach(() => {
    notificationService = {
      findByUser: jest.fn().mockResolvedValue({ data: [], unread_count: 0 }),
      markRead: jest.fn().mockResolvedValue(undefined),
      markAllRead: jest.fn().mockResolvedValue(undefined),
      registerClient: jest.fn().mockReturnValue(new Subject()),
      removeClient: jest.fn(),
    };
    controller = new NotificationController(notificationService as unknown as NotificationService);
  });

  it("findAll() retourne les notifs de l'utilisateur courant", async () => {
    const req = { user: { id: 'u1' } };
    await controller.findAll(req as any);
    expect(notificationService.findByUser).toHaveBeenCalledWith('u1');
  });

  it('markRead() appelle le service avec userId + notifId', async () => {
    const req = { user: { id: 'u1' } };
    await controller.markRead(req as any, 'n1');
    expect(notificationService.markRead).toHaveBeenCalledWith('u1', 'n1');
  });

  it('markAllRead() appelle le service avec userId', async () => {
    const req = { user: { id: 'u1' } };
    await controller.markAllRead(req as any);
    expect(notificationService.markAllRead).toHaveBeenCalledWith('u1');
  });

  it('stream() enregistre le client et retourne un Observable', () => {
    const req = { user: { id: 'u1' }, on: jest.fn() };
    const obs = controller.stream(req as any);
    expect(notificationService.registerClient).toHaveBeenCalledWith('u1');
    expect(obs).toBeDefined();
  });
});
