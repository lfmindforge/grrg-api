import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { FollowService } from './follow.service';

@Controller('follows')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Get(':id/followers')
  getFollowers(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.followService.getFollowers(id);
  }

  @Get(':id/following')
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
  follow(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.followService.follow(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.followService.unfollow(req.user.id, id);
  }
}
