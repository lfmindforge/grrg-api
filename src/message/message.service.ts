import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../user/user.entity';
import { NotificationService } from '../notifications/notification.service';
import { EventLogService } from '../event-log/event-log.service';
import { MessagingGateway } from './messaging.gateway';
import { EventType } from '../event-log/event-log.types';
import { NotificationType } from '../notifications/notification.types';
import { ConversationResponseDto, MessageResponseDto } from './dto/conversation-response.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifService: NotificationService,
    private readonly eventService: EventLogService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  async findOrCreateConversation(userAId: string, userBId: string): Promise<Conversation> {
    if (userAId === userBId) {
      throw new BadRequestException("Impossible d'envoyer un message à soi-même");
    }
    // ordre canonique : plus petit UUID en user_a (correspond à la contrainte CHECK en DB)
    const [a, b] = [userAId, userBId].sort();
    const existing = await this.convRepo.findOne({ where: { user_a_id: a, user_b_id: b }, withDeleted: true });
    if (existing) {
      // Restaure si précédemment supprimée (soft delete)
      if (existing.deleted_at) await this.convRepo.recover(existing);
      return existing;
    }
    const conv = this.convRepo.create({ user_a_id: a, user_b_id: b });
    return this.convRepo.save(conv);
  }

  async sendMessage(senderId: string, recipientId: string, content: string): Promise<MessageResponseDto> {
    const conversation = await this.findOrCreateConversation(senderId, recipientId);
    const sender = await this.userRepo.findOne({
      where: { id: senderId },
      select: ['id', 'pseudo', 'avatar_url'],
    });
    if (!sender) throw new NotFoundException('Utilisateur introuvable');

    const msg = await this.msgRepo.save(
      this.msgRepo.create({ conversation_id: conversation.id, sender_id: senderId, content }),
    );

    const dto = this.toMessageDto(msg, sender);

    // Temps réel : notifier les deux participants via Socket.IO
    this.messagingGateway.notifyNewMessage(recipientId, dto);
    // Le sender reçoit aussi l'événement pour mettre à jour sa tuile de conversation
    this.messagingGateway.notifyNewMessage(senderId, dto);

    await this.notifService.notify(recipientId, NotificationType.MESSAGE_RECEIVED, {
      sender_id: senderId,
      sender_pseudo: sender.pseudo,
      conversation_id: conversation.id,
      message_id: msg.id,
      content_preview: content.slice(0, 80),
    });

    await this.eventService.log(EventType.MESSAGE_SEND, senderId, {
      recipient_id: recipientId,
      conversation_id: conversation.id,
    });

    return dto;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    await this.convRepo.softRemove(conv);
  }

  async getConversations(userId: string): Promise<ConversationResponseDto[]> {
    const convs = await this.convRepo
      .createQueryBuilder('c')
      .where('(c.user_a_id = :id OR c.user_b_id = :id) AND c.deleted_at IS NULL', { id: userId })
      .leftJoinAndSelect('c.user_a', 'ua')
      .leftJoinAndSelect('c.user_b', 'ub')
      .getMany();

    const result: ConversationResponseDto[] = [];

    for (const conv of convs) {
      const otherUser = conv.user_a_id === userId ? conv.user_b : conv.user_a;

      const lastMsg = await this.msgRepo.findOne({
        where: { conversation_id: conv.id },
        order: { created_at: 'DESC' },
        relations: ['sender'],
      });

      const unreadCount = await this.msgRepo.count({
        where: { conversation_id: conv.id, is_read: false, sender_id: otherUser.id } as any,
      });

      result.push({
        id: conv.id,
        other_user: { id: otherUser.id, pseudo: otherUser.pseudo, avatar_url: otherUser.avatar_url, grade: otherUser.grade },
        last_message: lastMsg ? this.toMessageDto(lastMsg, lastMsg.sender) : null,
        unread_count: unreadCount,
        updated_at: lastMsg?.created_at ?? conv.created_at,
      });
    }

    return result.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
  ): Promise<{ data: MessageResponseDto[]; total: number }> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
      throw new ForbiddenException('Accès refusé');
    }

    const limit = 30;
    const [msgs, total] = await this.msgRepo.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['sender'],
      withDeleted: false,
    });

    return { data: msgs.map((m) => this.toMessageDto(m, m.sender)), total };
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    // Uniquement les messages REÇUS (envoyés par l'autre utilisateur) — ne pas toucher aux envoyés par userId
    await this.msgRepo.update(
      { conversation_id: conversationId, is_read: false, sender_id: Not(userId) },
      { is_read: true },
    );
  }

  private toMessageDto(msg: Message, sender: User): MessageResponseDto {
    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      sender_pseudo: sender.pseudo,
      sender_avatar: sender.avatar_url,
      content: msg.content,
      is_read: msg.is_read,
      created_at: msg.created_at,
    };
  }
}
