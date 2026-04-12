import { Injectable } from '@nestjs/common';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { LeaderboardResponse } from './leaderboard.types';

@Injectable()
export class LeaderboardService {
  async find(_dto: QueryLeaderboardDto): Promise<LeaderboardResponse> {
    throw new Error('Not implemented');
  }
}
