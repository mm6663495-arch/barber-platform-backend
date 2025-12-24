import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdvancedReportsService } from './advanced-reports.service';
import { CreateCustomReportDto, ReportPeriod, ReportCategory } from './dto/create-custom-report.dto';
import { ExportReportDto, ExportFormat } from './dto/export-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Advanced Reports')
@ApiBearerAuth()
@Controller('advanced-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdvancedReportsController {
  constructor(
    private readonly advancedReportsService: AdvancedReportsService,
  ) {}

  @Post('custom')
  @ApiOperation({ summary: 'Generate custom report' })
  @ApiResponse({ status: 201, description: 'Custom report generated successfully' })
  async generateCustomReport(@Body() createDto: CreateCustomReportDto) {
    return this.advancedReportsService.generateCustomReport(createDto);
  }

  @Post('export')
  @ApiOperation({ summary: 'Export report to PDF/Excel/CSV/JSON' })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  async exportReport(
    @Body() exportDto: ExportReportDto,
    @Res() res: Response,
  ) {
    const result = await this.advancedReportsService.exportReport(exportDto);

    // Set appropriate headers based on format
    switch (exportDto.format) {
      case ExportFormat.PDF:
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
        return res.send(result);
      case ExportFormat.EXCEL:
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
        return res.send(result);
      case ExportFormat.CSV:
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
        return res.send(result);
      case ExportFormat.JSON:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=report.json');
        return res.json(result);
      default:
        return res.json(result);
    }
  }

  @Get('periodic')
  @ApiOperation({ summary: 'Generate periodic report (daily, weekly, monthly)' })
  @ApiResponse({ status: 200, description: 'Periodic report generated successfully' })
  async generatePeriodicReport(
    @Query('period') period: ReportPeriod,
    @Query('category') category?: ReportCategory,
  ) {
    return this.advancedReportsService.generatePeriodicReport(period, category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all available report categories' })
  @ApiResponse({ status: 200, description: 'List of report categories' })
  getCategories() {
    return {
      success: true,
      data: {
        categories: Object.values(ReportCategory),
        periods: Object.values(ReportPeriod),
        exportFormats: Object.values(ExportFormat),
      },
    };
  }
}

