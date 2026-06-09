import { Module } from '@nestjs/common';
import { WishController } from './wish.controller';
import { WishService } from './wish.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wish } from './wish.entity';
import { StorageModule } from '../common/storage/storage.module';
import { EventLogModule } from '../event-log/event-log.module';
@Module({
  imports: [TypeOrmModule.forFeature([Wish]), StorageModule, EventLogModule],
  controllers: [WishController],
  providers: [WishService],
})
export class WishModule {}
