import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../user/user.types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateReportDto) {
    return this.reportService.createReport(req.user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query() dto: QueryReportsDto) {
    return this.reportService.getReports(dto);
  }
}
