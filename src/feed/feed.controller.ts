import { Controller, Get, Query, Req } from '@nestjs/common';
import { FeedService } from './feed.service';
import { QueryFeedDto } from './dto/query-feed.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // Requiert JWT (guard global appliqué dans AppModule)
  @Get()
  getFeed(
    @Req() req: { user: { id: string } },
    @Query() query: QueryFeedDto,
  ) {
    return this.feedService.getFeed(req.user.id, query);
  }

  // Public — accessible sans compte
  @Public()
  @Get('global')
  getGlobalFeed(@Query() query: QueryFeedDto) {
    return this.feedService.getGlobalFeed(query);
  }
}
