import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';

@Controller('donate')
export class DonationController {
  constructor(private readonly donationService: DonationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  propose(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreateDonationDto,
  ) {
    return this.donationService.propose(req.user.id, dto);
  }
}
