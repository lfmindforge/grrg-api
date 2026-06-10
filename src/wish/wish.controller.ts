import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { WishService } from './wish.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateWishDto } from './dto/create-wish.dto';
import { UpdateWishDto } from './dto/update-wish.dto';
import { QueryWishDto } from './dto/query-wish.dto';

@ApiTags('wishes')
@ApiCookieAuth('access_token')
@Controller('wishes')
export class WishController {
  constructor(private readonly wishService: WishService) {}

  // Déclaré avant @Get(':id') — NestJS résout les routes dans l'ordre
  @Get('me')
  @ApiOperation({ summary: 'Mes souhaits (authentifié)' })
  findMine(
    @Req() req: Request & { user: { id: string } },
    @Query() query: QueryWishDto,
  ) {
    return this.wishService.findMine(req.user.id, query);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Liste des catégories de souhaits existantes' })
  getCategories() {
    return this.wishService.findCategories();
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Feed public de souhaits (filtrable, paginé)' })
  findPublic(@Query() query: QueryWishDto) {
    return this.wishService.findPublic(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détail d\'un souhait' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.wishService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un souhait (propriétaire uniquement)' })
  @UseInterceptors(
    FileInterceptor('media', {
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { id: string } },
    @Body() dto: UpdateWishDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.wishService.update(id, req.user.id, dto, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un souhait (soft delete)' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.wishService.softDelete(id, req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un souhait avec upload médias (multipart)' })
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
