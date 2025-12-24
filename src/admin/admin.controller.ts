import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Delete,
  Patch,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdvancedDashboardService } from './advanced-dashboard.service';
import { ChartDataRequestDto } from './dto/chart-data.dto';
import { TimeComparisonDto } from './dto/time-comparison.dto';
import { PredictionDto } from './dto/prediction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdvancedRateLimitGuard } from '../common/guards/rate-limit.guard';

/**
 * Admin Controller
 * لوحة التحكم للمسؤولين + إدارة الأمان
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly advancedDashboardService: AdvancedDashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'لوحة التحكم الرئيسية' })
  getDashboard() {
    return this.adminService.getDashboardStatistics();
  }

  @Post('dashboard/charts')
  @ApiOperation({ summary: 'Get interactive chart data' })
  getChartData(@Body() request: ChartDataRequestDto) {
    return this.advancedDashboardService.getChartData(request);
  }

  @Post('dashboard/time-comparison')
  @ApiOperation({ summary: 'Get time comparison data' })
  getTimeComparison(@Body() comparison: TimeComparisonDto) {
    return this.advancedDashboardService.getTimeComparison(comparison);
  }

  @Post('dashboard/predictions')
  @ApiOperation({ summary: 'Get predictions and analytics' })
  getPredictions(@Body() prediction: PredictionDto) {
    return this.advancedDashboardService.getPredictions(prediction);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'النشاط الأخير' })
  getRecentActivity() {
    return this.adminService.getRecentActivity();
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'الموافقات المعلقة' })
  getPendingApprovals() {
    return this.adminService.getPendingApprovals();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'تحليلات الإيرادات' })
  getRevenue() {
    return this.adminService.getRevenueAnalytics();
  }

  @Get('users/analytics')
  @ApiOperation({ summary: 'تحليلات المستخدمين' })
  getUserAnalytics() {
    return this.adminService.getUserAnalytics();
  }

  @Get('health')
  @ApiOperation({ summary: 'فحص صحة النظام' })
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('health/json')
  @ApiOperation({ summary: 'فحص صحة JSON في الجداول' })
  getJsonHealth() {
    return this.adminService.getJsonHealth();
  }

  @Post('repair-json')
  @ApiOperation({ summary: 'إصلاح JSON غير الصالح في الجداول' })
  repairJson() {
    return this.adminService.repairJson();
  }

  // ==========================================
  // Security & Rate Limiting Management
  // ==========================================

  @Get('security/rate-limit-stats')
  @ApiOperation({ summary: 'إحصائيات Rate Limiting' })
  getRateLimitStats() {
    return {
      success: true,
      data: AdvancedRateLimitGuard.getStats(),
    };
  }

  @Get('security/blocked-ips')
  @ApiOperation({ summary: 'قائمة IPs المحظورة' })
  getBlockedIps() {
    return {
      success: true,
      data: {
        blockedIps: AdvancedRateLimitGuard.getBlockedIps(),
        count: AdvancedRateLimitGuard.getBlockedIps().length,
      },
    };
  }

  @Delete('security/unblock-ip/:ip')
  @ApiOperation({ summary: 'إلغاء حظر IP' })
  unblockIp(@Param('ip') ip: string) {
    const unblocked = AdvancedRateLimitGuard.unblockIp(ip);
    
    return {
      success: unblocked,
      message: unblocked
        ? `تم إلغاء حظر IP: ${ip}`
        : `IP غير محظور: ${ip}`,
    };
  }

  // ==========================================
  // Reports Management
  // ==========================================

  @Get('reports')
  @ApiOperation({ summary: 'الحصول على جميع البلاغات' })
  getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getReports(pageNum, limitNum, status, type);
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({ summary: 'حل البلاغ' })
  resolveReport(@Param('id') id: string) {
    return this.adminService.resolveReport(parseInt(id, 10));
  }

  @Patch('reports/:id/reject')
  @ApiOperation({ summary: 'رفض البلاغ' })
  rejectReport(@Param('id') id: string) {
    return this.adminService.rejectReport(parseInt(id, 10));
  }

  @Patch('reviews/:id/approve')
  @ApiOperation({ summary: 'الموافقة على التقييم' })
  approveReview(@Param('id') id: string) {
    return this.adminService.approveReview(parseInt(id, 10));
  }

  // ==========================================
  // Billing Management
  // ==========================================

  @Get('payments')
  @ApiOperation({ summary: 'الحصول على جميع المدفوعات' })
  getPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getPayments(
      pageNum,
      limitNum,
      status,
      method,
      startDate,
      endDate,
    );
  }

  @Get('invoices')
  @ApiOperation({ summary: 'الحصول على جميع الفواتير' })
  getInvoices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getInvoices(
      pageNum,
      limitNum,
      status,
      startDate,
      endDate,
    );
  }
}
