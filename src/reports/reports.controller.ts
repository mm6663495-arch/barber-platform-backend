import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UnifiedReportsService } from './services/unified-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Reports Controller
 * Controller للتقارير الموحدة
 */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: UnifiedReportsService) {}

  /**
   * الحصول على تقرير شامل
   */
  @Get('comprehensive')
  @ApiOperation({ summary: 'تقرير شامل للنظام' })
  getComprehensiveReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeUsers') includeUsers?: string,
    @Query('includeSalons') includeSalons?: string,
    @Query('includeSubscriptions') includeSubscriptions?: string,
    @Query('includePayments') includePayments?: string,
    @Query('includeReviews') includeReviews?: string,
    @Query('includeReports') includeReports?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: includeUsers !== 'false',
      includeSalons: includeSalons !== 'false',
      includeSubscriptions: includeSubscriptions !== 'false',
      includePayments: includePayments !== 'false',
      includeReviews: includeReviews !== 'false',
      includeReports: includeReports !== 'false',
    });
  }

  /**
   * الحصول على تقرير المستخدمين
   */
  @Get('users')
  @ApiOperation({ summary: 'تقرير المستخدمين' })
  getUsersReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: true,
      includeSalons: false,
      includeSubscriptions: false,
      includePayments: false,
      includeReviews: false,
      includeReports: false,
    }).then((report) => report.users);
  }

  /**
   * الحصول على تقرير الصالونات
   */
  @Get('salons')
  @ApiOperation({ summary: 'تقرير الصالونات' })
  getSalonsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: false,
      includeSalons: true,
      includeSubscriptions: false,
      includePayments: false,
      includeReviews: false,
      includeReports: false,
    }).then((report) => report.salons);
  }

  /**
   * الحصول على تقرير المدفوعات
   */
  @Get('payments')
  @ApiOperation({ summary: 'تقرير المدفوعات' })
  getPaymentsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: false,
      includeSalons: false,
      includeSubscriptions: false,
      includePayments: true,
      includeReviews: false,
      includeReports: false,
    }).then((report) => report.payments);
  }

  /**
   * الحصول على تقرير التقييمات
   */
  @Get('reviews')
  @ApiOperation({ summary: 'تقرير التقييمات' })
  getReviewsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: false,
      includeSalons: false,
      includeSubscriptions: false,
      includePayments: false,
      includeReviews: true,
      includeReports: false,
    }).then((report) => report.reviews);
  }

  /**
   * الحصول على تقرير البلاغات
   */
  @Get('reports')
  @ApiOperation({ summary: 'تقرير البلاغات' })
  getReportsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers: false,
      includeSalons: false,
      includeSubscriptions: false,
      includePayments: false,
      includeReviews: false,
      includeReports: true,
    }).then((report) => report.reports);
  }

  /**
   * تصدير التقرير الشامل
   */
  @Post('export')
  @ApiOperation({ summary: 'تصدير التقرير الشامل' })
  async exportReport(
    @Body('format') format: 'pdf' | 'excel' | 'csv' | 'json',
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
    @Body('includeUsers') includeUsers?: boolean,
    @Body('includeSalons') includeSalons?: boolean,
    @Body('includeSubscriptions') includeSubscriptions?: boolean,
    @Body('includePayments') includePayments?: boolean,
    @Body('includeReviews') includeReviews?: boolean,
    @Body('includeReports') includeReports?: boolean,
  ) {
    const report = await this.reportsService.getComprehensiveReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeUsers,
      includeSalons,
      includeSubscriptions,
      includePayments,
      includeReviews,
      includeReports,
    });

    let filepath: string;
    switch (format) {
      case 'pdf':
        filepath = await this.reportsService.exportToPDF(report);
        break;
      case 'excel':
        filepath = await this.reportsService.exportToExcel(report);
        break;
      case 'csv':
        filepath = await this.reportsService.exportToCSV(report);
        break;
      case 'json':
        filepath = await this.reportsService.exportToJSON(report);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return {
      success: true,
      filepath,
      format,
      message: `تم تصدير التقرير بنجاح بصيغة ${format}`,
    };
  }
}

