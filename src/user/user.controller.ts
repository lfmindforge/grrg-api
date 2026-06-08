import {
  Controller,
  Get,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Body,
  Req,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../common/decorators/public.decorator';
import { UserService } from './user.service';
import { FollowService } from '../follow/follow.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserExportDto } from './dto/user-export.dto';
import { UserPublicProfileDto } from './user.types';
import { SuggestionDto } from '../follow/follow.types';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly followService: FollowService,
  ) {}

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@Req() req: { user: { id: string } }): Promise<void> {
    return this.userService.deleteMe(req.user.id);
  }

  @Get('me/export')
  exportMe(@Req() req: { user: { id: string } }): Promise<UserExportDto> {
    return this.userService.exportMe(req.user.id);
  }

  @Get('suggestions')
  getSuggestions(
    @Req() req: { user: { id: string } },
  ): Promise<SuggestionDto[]> {
    return this.followService.getSuggestions(req.user.id);
  }

  @Get(':id')
  @Public()
  getProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserPublicProfileDto> {
    return this.userService.getProfile(id);
  }

  @Put('me')
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
