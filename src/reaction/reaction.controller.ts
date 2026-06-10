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
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ReactionService } from './reaction.service';
import { UpsertReactionDto } from './dto/upsert-reaction.dto';

@ApiTags('reactions')
@ApiCookieAuth('access_token')
@Controller('wishes/:wishId/reactions')
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ajouter ou modifier sa réaction sur un souhait' })
  upsert(
    @Req() req: { user: { id: string } },
    @Param('wishId', ParseUUIDPipe) wishId: string,
    @Body() dto: UpsertReactionDto,
  ) {
    return this.reactionService.upsert(req.user.id, wishId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer sa réaction sur un souhait' })
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
