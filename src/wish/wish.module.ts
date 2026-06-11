import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';
import { WishSchedulerService } from './wish-scheduler.service';
import { Wish } from './wish.entity';
import { StorageModule } from '../common/storage/storage.module';
import { EventLogModule } from '../event-log/event-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wish]),
    StorageModule,
    EventLogModule,
    NotificationsModule,
  ],
  controllers: [WishController],
  providers: [WishService, WishSchedulerService],
})
export class WishModule {}
