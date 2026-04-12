import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LeaderboardService } from './leaderboard.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @Public()
  find(@Query() query: QueryLeaderboardDto) {
    return this.leaderboardService.find(query);
  }
}
