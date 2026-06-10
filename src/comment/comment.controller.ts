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
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CommentService } from './comment.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';

// Pas de préfixe commun : les routes sont /wishes/:id/comments et /comments/:id
@ApiTags('comments')
@ApiCookieAuth('access_token')
@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('wishes/:wishId/comments')
  @ApiOperation({ summary: 'Commentaires d\'un souhait' })
  getComments(
    @Param('wishId', ParseUUIDPipe) wishId: string,
    @Query() dto: QueryCommentsDto,
  ) {
    return this.commentService.getComments(wishId, dto);
  }

  @Post('wishes/:wishId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Poster un commentaire sur un souhait' })
  addComment(
    @Req() req: { user: { id: string } },
    @Param('wishId', ParseUUIDPipe) wishId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.addComment(req.user.id, wishId, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un commentaire (auteur ou admin)' })
  deleteComment(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commentService.deleteComment(req.user.id, id);
  }

  @Post('comments/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportComment(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commentService.reportComment(req.user.id, id);
  }
}
