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
import { EvaluationService } from './evaluation.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller('evaluations')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post(':donationId')
  @HttpCode(HttpStatus.CREATED)
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
