import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LeaderboardService } from './leaderboard.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Classement des donateurs (global / mensuel / par catégorie)' })
  find(@Query() query: QueryLeaderboardDto) {
    return this.leaderboardService.find(query);
  }
}
