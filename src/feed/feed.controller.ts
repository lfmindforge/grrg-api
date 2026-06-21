import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { QueryFeedDto } from './dto/query-feed.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('feed')
@ApiCookieAuth('access_token')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // Requiert JWT (guard global appliqué dans AppModule)
  @Get()
  @ApiOperation({ summary: 'Fil d\'actualité des utilisateurs suivis' })
  getFeed(
    @Req() req: { user: { id: string } },
    @Query() query: QueryFeedDto,
  ) {
    return this.feedService.getFeed(req.user.id, query);
  }

  // Public — accessible sans compte
  @Public()
  @Get('global')
  @ApiOperation({ summary: 'Fil d\'actualité global (public)' })
  getGlobalFeed(@Query() query: QueryFeedDto) {
    return this.feedService.getGlobalFeed(query);
  }
}
