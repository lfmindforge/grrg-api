import { Controller, Get, HttpCode, Param, Patch, Req, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiCookieAuth('access_token')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Mes notifications (30 dernières)' })
  findAll(@Req() req: { user: { id: string } }) {
    return this.notificationService.findByUser(req.user.id);
  }

  @Patch('read-all')
  @HttpCode(204)
  async markAllRead(@Req() req: { user: { id: string } }): Promise<void> {
    await this.notificationService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  @HttpCode(204)
  async markRead(@Req() req: { user: { id: string } }, @Param('id') id: string): Promise<void> {
    await this.notificationService.markRead(req.user.id, id);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Flux SSE de notifications en temps réel' })
  stream(@Req() req: { user: { id: string }; on: (event: string, cb: () => void) => void }): Observable<MessageEvent> {
    const subject: Subject<MessageEvent> = this.notificationService.registerClient(req.user.id);
    req.on('close', () => this.notificationService.removeClient(req.user.id, subject));
    return subject.asObservable();
  }
}
