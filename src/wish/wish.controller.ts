import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { WishService } from './wish.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateWishDto } from './dto/create-wish.dto';

@Controller('wishes')
export class WishController {
  constructor(private readonly wishService: WishService) {}

  @Get()
  @Public()
  findPublic() {
    return this.wishService.findPublic();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('media', 3, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'video/mp4'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Type de fichier non autorisé : jpg, png, mp4 uniquement',
            ),
            false,
          );
        }
      },
    }),
  )
  create(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreateWishDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.wishService.create(req.user.id, dto, files ?? []);
  }
}
