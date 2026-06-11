import {
  Controller,
  Get,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Body,
  Req,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { UserService } from './user.service';
import { FollowService } from '../follow/follow.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserExportDto } from './dto/user-export.dto';
import { UserPublicProfileDto, UserSearchResultDto } from './user.types';
import { SuggestionDto } from '../follow/follow.types';

@ApiTags('users')
@ApiCookieAuth('access_token')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly followService: FollowService,
  ) {}

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer son compte (anonymisation RGPD)' })
  deleteMe(@Req() req: { user: { id: string } }): Promise<void> {
    return this.userService.deleteMe(req.user.id);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Exporter ses données personnelles (RGPD)' })
  exportMe(@Req() req: { user: { id: string } }): Promise<UserExportDto> {
    return this.userService.exportMe(req.user.id);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggestions de donateurs à suivre' })
  getSuggestions(
    @Req() req: { user: { id: string } },
  ): Promise<SuggestionDto[]> {
    return this.followService.getSuggestions(req.user.id);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Rechercher des utilisateurs par pseudo' })
  searchUsers(@Query('q') q = ''): Promise<UserSearchResultDto[]> {
    return this.userService.search(q);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Profil public d\'un utilisateur' })
  getProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserPublicProfileDto> {
    return this.userService.getProfile(id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Modifier son profil (pseudo, bio, avatar)' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  updateMe(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserPublicProfileDto> {
    return this.userService.updateMe(req.user.id, dto, file);
  }
}
