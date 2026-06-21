import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Wish } from '../wish/wish.entity';
import { Comment } from '../comment/comment.entity';
import { Donation } from '../donation/donation.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { EventLogModule } from '../event-log/event-log.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wish, Comment, Donation]), EventLogModule, MailModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
