import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLog } from './event-log.entity';
import { User } from '../user/user.entity';
import { EventLogService } from './event-log.service';
import { EventLogController } from './event-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventLog, User])],
  providers: [EventLogService],
  controllers: [EventLogController],
  exports: [EventLogService],
})
export class EventLogModule {}
