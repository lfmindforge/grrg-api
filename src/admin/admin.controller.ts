import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminStatsDto } from './dto/admin-stats.dto';
import { BanUserDto } from './dto/ban-user.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(): Promise<AdminStatsDto> {
    return this.adminService.getStats();
  }

  @Get('users/search')
  searchUsers(@Query('q') q: string) {
    return this.adminService.searchUsers(q ?? '');
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  banUser(
    @Request() req: { user: { id: string } },
    @Param('id') userId: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(req.user.id, userId, dto);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.NO_CONTENT)
  unbanUser(
    @Request() req: { user: { id: string } },
    @Param('id') userId: string,
  ) {
    return this.adminService.unbanUser(req.user.id, userId);
  }

  @Delete('content/:type/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteContent(
    @Request() req: { user: { id: string } },
    @Param('type') type: 'wish' | 'comment',
    @Param('id') id: string,
  ) {
    return this.adminService.deleteContent(req.user.id, type, id);
  }
}
