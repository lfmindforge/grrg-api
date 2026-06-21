import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@ApiTags('evaluations')
@ApiCookieAuth('access_token')
@Controller('evaluations')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post(':donationId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Évaluer un don reçu (déclenche le Glow du donateur)' })
  @UseInterceptors(FileInterceptor('proof'))
  evaluate(
    @Req() req: Request & { user: { id: string } },
    @Param('donationId', ParseUUIDPipe) donationId: string,
    @Body() dto: CreateEvaluationDto,
    @UploadedFile() proof: Express.Multer.File,
  ) {
    return this.evaluationService.evaluate(req.user.id, donationId, dto, proof);
  }
}
