import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { FollowService } from './follow.service';

@ApiTags('follows')
@ApiCookieAuth('access_token')
@Controller('follows')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Get(':id/followers')
  @ApiOperation({ summary: 'Liste des abonnés d\'un utilisateur' })
  getFollowers(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.followService.getFollowers(id);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Liste des abonnements d\'un utilisateur' })
  getFollowing(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.followService.getFollowing(id);
  }

  @Get(':id')
  async checkFollow(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ is_following: boolean }> {
    const is_following = await this.followService.isFollowing(req.user.id, id);
    return { is_following };
  }

  @Post(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suivre un utilisateur' })
  follow(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.followService.follow(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ne plus suivre un utilisateur' })
  unfollow(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.followService.unfollow(req.user.id, id);
  }
}
