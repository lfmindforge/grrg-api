import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import { Message } from './message.entity';
import { Conversation } from './conversation.entity';
import { User } from '../user/user.entity';
import { NotificationService } from '../notifications/notification.service';
import { EventLogService } from '../event-log/event-log.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('MessageService', () => {
  let service: MessageService;
  let convRepo: ReturnType<typeof mockRepo>;
  let msgRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let notifService: { notify: jest.Mock };
  let eventService: { log: jest.Mock };

  beforeEach(async () => {
    convRepo = mockRepo();
    msgRepo = mockRepo();
    userRepo = mockRepo();
    notifService = { notify: jest.fn() };
    eventService = { log: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: getRepositoryToken(Conversation), useValue: convRepo },
        { provide: getRepositoryToken(Message), useValue: msgRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationService, useValue: notifService },
        { provide: EventLogService, useValue: eventService },
      ],
    }).compile();

    service = module.get(MessageService);
  });

  describe('findOrCreateConversation', () => {
    it('retourne une conversation existante', async () => {
      const conv = { id: 'conv-1', user_a_id: 'aaa', user_b_id: 'bbb' };
      convRepo.findOne.mockResolvedValue(conv);
      const result = await service.findOrCreateConversation('bbb', 'aaa');
      expect(convRepo.findOne).toHaveBeenCalledWith({ where: { user_a_id: 'aaa', user_b_id: 'bbb' } });
      expect(result).toBe(conv);
    });

    it('crée une conversation si inexistante', async () => {
      convRepo.findOne.mockResolvedValue(null);
      const newConv = { id: 'conv-new' };
      convRepo.create.mockReturnValue(newConv);
      convRepo.save.mockResolvedValue(newConv);
      const result = await service.findOrCreateConversation('bbb', 'aaa');
      expect(convRepo.save).toHaveBeenCalled();
      expect(result).toBe(newConv);
    });

    it('rejette si sender === recipient', async () => {
      await expect(service.findOrCreateConversation('aaa', 'aaa')).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendMessage', () => {
    it('crée un message et notifie le destinataire', async () => {
      const conv = { id: 'conv-1', user_a_id: 'aaa', user_b_id: 'bbb' };
      convRepo.findOne.mockResolvedValue(conv);
      convRepo.create.mockReturnValue(conv);
      convRepo.save.mockResolvedValue(conv);
      const sender = { id: 'aaa', pseudo: 'Alice', avatar_url: null };
      userRepo.findOne.mockResolvedValue(sender);
      const msg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'aaa',
        content: 'Salut',
        is_read: false,
        created_at: new Date(),
        deleted_at: null,
      };
      msgRepo.create.mockReturnValue(msg);
      msgRepo.save.mockResolvedValue(msg);

      await service.sendMessage('aaa', 'bbb', 'Salut');

      expect(msgRepo.save).toHaveBeenCalled();
      expect(notifService.notify).toHaveBeenCalledWith('bbb', 'message_received', expect.any(Object));
    });
  });

  describe('markRead', () => {
    it('marque les messages non lus comme lus', async () => {
      convRepo.findOne.mockResolvedValue({ id: 'conv-1', user_a_id: 'aaa', user_b_id: 'bbb' });
      msgRepo.update = jest.fn().mockResolvedValue({ affected: 2 });
      await service.markRead('bbb', 'conv-1');
      expect(msgRepo.update).toHaveBeenCalledWith(
        { conversation_id: 'conv-1', is_read: false },
        { is_read: true },
      );
    });

    it("rejette si l'utilisateur n'appartient pas à la conversation", async () => {
      convRepo.findOne.mockResolvedValue({ id: 'conv-1', user_a_id: 'aaa', user_b_id: 'bbb' });
      await expect(service.markRead('ccc', 'conv-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
