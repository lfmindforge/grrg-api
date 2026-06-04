import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ReactionService } from './reaction.service';
import { UpsertReactionDto } from './dto/upsert-reaction.dto';

@Controller('wishes/:wishId/reactions')
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  upsert(
    @Req() req: { user: { id: string } },
    @Param('wishId', ParseUUIDPipe) wishId: string,
    @Body() dto: UpsertReactionDto,
  ) {
    return this.reactionService.upsert(req.user.id, wishId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Req() req: { user: { id: string } },
    @Param('wishId', ParseUUIDPipe) wishId: string,
  ) {
    return this.reactionService.delete(req.user.id, wishId);
  }

  @Get('me')
  getMyReaction(
    @Req() req: { user: { id: string } },
    @Param('wishId', ParseUUIDPipe) wishId: string,
  ) {
    return this.reactionService.getMyReaction(req.user.id, wishId);
  }
}
