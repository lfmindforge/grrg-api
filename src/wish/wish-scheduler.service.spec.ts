import { WishSchedulerService } from './wish-scheduler.service';
import { WishStatus } from './wish.types';
import { NotificationType } from '../notifications/notification.types';

describe('WishSchedulerService', () => {
  let service: WishSchedulerService;

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const mockWishRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    save: jest.fn(),
  };
  const mockNotificationService = {
    notify: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWishRepo.createQueryBuilder.mockReturnValue(mockQb);
    service = new WishSchedulerService(
      mockWishRepo as any,
      mockNotificationService as any,
    );
  });

  it('expireWishes() passe les souhaits échus à EXPIRED et notifie le créateur', async () => {
    const expiredWish = { id: 'w1', user_id: 'u1', title: 'Un vélo', status: WishStatus.PENDING };
    mockQb.getMany.mockResolvedValue([expiredWish]);
    mockWishRepo.save.mockResolvedValue({ ...expiredWish, status: WishStatus.EXPIRED });

    await service.expireWishes();

    expect(expiredWish.status).toBe(WishStatus.EXPIRED);
    expect(mockWishRepo.save).toHaveBeenCalledWith(expiredWish);
    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      'u1',
      NotificationType.WISH_EXPIRED,
      { wish_title: 'Un vélo', wish_id: 'w1' },
    );
  });

  it('expireWishes() ne fait rien si aucun souhait échu', async () => {
    mockQb.getMany.mockResolvedValue([]);

    await service.expireWishes();

    expect(mockWishRepo.save).not.toHaveBeenCalled();
    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });

  it('expireWishes() traite plusieurs souhaits en une passe', async () => {
    const wishes = [
      { id: 'w1', user_id: 'u1', title: 'Souhait 1', status: WishStatus.PENDING },
      { id: 'w2', user_id: 'u2', title: 'Souhait 2', status: WishStatus.IN_PROGRESS },
    ];
    mockQb.getMany.mockResolvedValue(wishes);
    mockWishRepo.save.mockResolvedValue(undefined);

    await service.expireWishes();

    expect(mockWishRepo.save).toHaveBeenCalledTimes(2);
    expect(mockNotificationService.notify).toHaveBeenCalledTimes(2);
    expect(wishes[0].status).toBe(WishStatus.EXPIRED);
    expect(wishes[1].status).toBe(WishStatus.EXPIRED);
  });
});
