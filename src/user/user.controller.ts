import {
  Controller,
  Get,
  Put,
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
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPublicProfileDto } from './user.types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
