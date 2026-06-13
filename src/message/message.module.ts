import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../user/user.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessagingGateway } from './messaging.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventLogModule } from '../event-log/event-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    NotificationsModule,
    EventLogModule,
    JwtModule.register({}),
  ],
  controllers: [MessageController],
  providers: [MessageService, MessagingGateway],
  exports: [MessageService],
})
export class MessageModule {}
