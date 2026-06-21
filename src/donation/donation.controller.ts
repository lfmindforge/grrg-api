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
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';

@ApiTags('donations')
@ApiCookieAuth('access_token')
@Controller('donations')
export class DonationController {
  constructor(private readonly donationService: DonationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Proposer un don sur un souhait' })
  propose(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreateDonationDto,
  ) {
    return this.donationService.propose(req.user.id, dto);
  }

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer la réception d\'un don' })
  confirm(
    @Req() req: Request & { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.donationService.confirm(req.user.id, id);
  }

  @Get('received')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dons reçus sur mes souhaits' })
  findReceived(@Req() req: Request & { user: { id: string } }) {
    return this.donationService.findReceived(req.user.id);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Historique de mes dons effectués' })
  findMyDonations(@Req() req: Request & { user: { id: string } }) {
    return this.donationService.findMyDonations(req.user.id);
  }
}
