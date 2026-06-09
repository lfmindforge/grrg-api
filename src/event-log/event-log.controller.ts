import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { EventLogService } from './event-log.service';
import { QueryEventLogDto } from './dto/query-event-log.dto';

@Controller('admin')
@Roles('admin')
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  @Get('events')
  findAll(@Query() query: QueryEventLogDto) {
    return this.eventLogService.findAll(query);
  }
}
