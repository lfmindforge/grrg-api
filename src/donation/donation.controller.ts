import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';

@Controller('donations')
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

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Req() req: Request & { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.donationService.confirm(req.user.id, id);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  findMyDonations(@Req() req: Request & { user: { id: string } }) {
    return this.donationService.findMyDonations(req.user.id);
  }
}
