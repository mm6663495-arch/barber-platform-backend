import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomReportDto, ReportCategory, ReportPeriod } from './dto/create-custom-report.dto';
import { ExportReportDto, ExportFormat } from './dto/export-report.dto';
// Libraries will be imported when installed
// import * as ExcelJS from 'exceljs';
// import * as PDFDocument from 'pdfkit';

@Injectable()
export class AdvancedReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate custom report based on category and filters
   */
  async generateCustomReport(createDto: CreateCustomReportDto) {
    const { category, period, dateRange, filters, fields, groupBy, sortBy, sortOrder } = createDto;

    // Calculate date range based on period
    const calculatedDateRange = this.calculateDateRange(period, dateRange);

    let reportData: any;

    switch (category) {
      case ReportCategory.USERS:
        reportData = await this.generateUsersReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.SALONS:
        reportData = await this.generateSalonsReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.SUBSCRIPTIONS:
        reportData = await this.generateSubscriptionsReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.PAYMENTS:
        reportData = await this.generatePaymentsReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.REVIEWS:
        reportData = await this.generateReviewsReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.VISITS:
        reportData = await this.generateVisitsReport(
          calculatedDateRange,
          filters,
          fields,
          groupBy,
          sortBy,
          sortOrder,
        );
        break;
      case ReportCategory.FINANCIAL:
        reportData = await this.generateFinancialReport(
          calculatedDateRange,
          filters,
        );
        break;
      case ReportCategory.ANALYTICS:
        reportData = await this.generateAnalyticsReport(
          calculatedDateRange,
          filters,
        );
        break;
      default:
        throw new BadRequestException(`Unsupported report category: ${category}`);
    }

    return {
      success: true,
      data: {
        report: {
          name: createDto.name,
          category,
          period,
          dateRange: calculatedDateRange,
          generatedAt: new Date(),
          ...reportData,
        },
      },
    };
  }

  /**
   * Export report to specified format
   */
  async exportReport(exportDto: ExportReportDto, reportData?: any) {
    const { format, data, includeCharts, template } = exportDto;

    const dataToExport = data || reportData;

    if (!dataToExport) {
      throw new BadRequestException('No data provided for export');
    }

    switch (format) {
      case ExportFormat.PDF:
        return await this.exportToPDF(dataToExport, includeCharts, template);
      case ExportFormat.EXCEL:
        return await this.exportToExcel(dataToExport, includeCharts);
      case ExportFormat.CSV:
        return await this.exportToCSV(dataToExport);
      case ExportFormat.JSON:
        return await this.exportToJSON(dataToExport);
      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate periodic reports (daily, weekly, monthly)
   */
  async generatePeriodicReport(period: ReportPeriod, category?: ReportCategory) {
    const dateRange = this.calculateDateRange(period);

    const reports: any = {};

    if (!category || category === ReportCategory.FINANCIAL) {
      reports.financial = await this.generateFinancialReport(dateRange);
    }

    if (!category || category === ReportCategory.ANALYTICS) {
      reports.analytics = await this.generateAnalyticsReport(dateRange);
    }

    if (!category || category === ReportCategory.USERS) {
      reports.users = await this.generateUsersReport(dateRange);
    }

    if (!category || category === ReportCategory.SALONS) {
      reports.salons = await this.generateSalonsReport(dateRange);
    }

    return {
      success: true,
      data: {
        period,
        dateRange,
        generatedAt: new Date(),
        reports,
      },
    };
  }

  // Private helper methods

  private calculateDateRange(period: ReportPeriod, customRange?: { startDate: string; endDate: string }) {
    if (period === ReportPeriod.CUSTOM && customRange) {
      return {
        startDate: new Date(customRange.startDate),
        endDate: new Date(customRange.endDate),
      };
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (period) {
      case ReportPeriod.DAILY:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case ReportPeriod.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case ReportPeriod.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case ReportPeriod.YEARLY:
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  private async generateUsersReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (filters) {
      if (filters.role) where.role = filters.role;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: fields
        ? {
            id: fields.includes('id'),
            email: fields.includes('email'),
            role: fields.includes('role'),
            isActive: fields.includes('isActive'),
            createdAt: fields.includes('createdAt'),
          }
        : undefined,
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
    });

    const stats = {
      total: users.length,
      byRole: this.groupBy(users, 'role'),
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
    };

    return {
      data: users,
      stats,
      summary: {
        totalUsers: users.length,
        newUsers: users.length,
        activeUsers: stats.active,
      },
    };
  }

  private async generateSalonsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (filters) {
      if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
    }

    const salons = await this.prisma.salon.findMany({
      where,
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
    });

    const stats = {
      total: salons.length,
      byApproval: {
        approved: salons.filter((s) => s.isApproved).length,
        pending: salons.filter((s) => !s.isApproved).length,
      },
      approved: salons.filter((s) => s.isApproved).length,
      pending: salons.filter((s) => !s.isApproved).length,
    };

    return {
      data: salons,
      stats,
      summary: {
        totalSalons: salons.length,
        approvedSalons: stats.approved,
        pendingSalons: stats.pending,
      },
    };
  }

  private async generateSubscriptionsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (filters) {
      if (filters.status) where.status = filters.status;
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      include: {
        customer: {
          select: {
            fullName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        package: { select: { name: true, price: true } },
      },
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
    });

    const stats = {
      total: subscriptions.length,
      byStatus: this.groupBy(subscriptions, 'status'),
      totalRevenue: subscriptions.reduce(
        (sum, sub) => sum + Number((sub as any).package?.price || 0),
        0,
      ),
    };

    return {
      data: subscriptions,
      stats,
      summary: {
        totalSubscriptions: subscriptions.length,
        totalRevenue: stats.totalRevenue,
        activeSubscriptions: stats.byStatus.ACTIVE?.length || 0,
      },
    };
  }

  private async generatePaymentsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (filters) {
      if (filters.status) where.status = filters.status;
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        subscription: {
          include: {
            customer: { select: { fullName: true } },
            package: { select: { name: true } },
          },
        },
      },
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
    });

    const stats = {
      total: payments.length,
      byStatus: this.groupBy(payments, 'status'),
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      completedAmount: payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    };

    return {
      data: payments,
      stats,
      summary: {
        totalPayments: payments.length,
        totalAmount: stats.totalAmount,
        completedAmount: stats.completedAmount,
      },
    };
  }

  private async generateReviewsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    const reviews = await this.prisma.review.findMany({
      where,
      include: {
        customer: { select: { fullName: true } },
        salon: { select: { name: true } },
      },
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' },
    });

    const stats = {
      total: reviews.length,
      averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
      byRating: this.groupBy(reviews, 'rating'),
    };

    return {
      data: reviews,
      stats,
      summary: {
        totalReviews: reviews.length,
        averageRating: stats.averageRating,
      },
    };
  }

  private async generateVisitsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
    fields?: string[],
    groupBy?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: any = {
      visitDate: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (filters) {
      if (filters.status) where.status = filters.status;
    }

    const visits = await this.prisma.visit.findMany({
      where,
      include: {
        subscription: {
          include: {
            customer: { select: { fullName: true } },
          },
        },
        salon: { select: { name: true } },
      },
      orderBy: sortBy ? { [sortBy]: sortOrder || 'desc' } : { visitDate: 'desc' },
    });

    const stats = {
      total: visits.length,
      byStatus: this.groupBy(visits, 'status'),
      completed: visits.filter((v) => v.status === 'COMPLETED').length,
    };

    return {
      data: visits,
      stats,
      summary: {
        totalVisits: visits.length,
        completedVisits: stats.completed,
      },
    };
  }

  private async generateFinancialReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        status: 'COMPLETED',
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      include: {
        package: { select: { price: true } },
      },
    });

    const potentialRevenue = subscriptions.reduce(
      (sum, sub) => sum + Number(sub.package.price || 0),
      0,
    );

    return {
      totalRevenue,
      potentialRevenue,
      totalPayments: payments.length,
      averagePayment: totalRevenue / payments.length || 0,
      byPaymentMethod: this.groupBy(payments, 'paymentMethod'),
    };
  }

  private async generateAnalyticsReport(
    dateRange: { startDate: Date; endDate: Date },
    filters?: Record<string, any>,
  ) {
    const [users, salons, subscriptions, payments, reviews, visits] = await Promise.all([
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      }),
      this.prisma.salon.count({
        where: {
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      }),
      this.prisma.subscription.count({
        where: {
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
          status: 'COMPLETED',
        },
      }),
      this.prisma.review.count({
        where: {
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      }),
      this.prisma.visit.count({
        where: {
          visitDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      }),
    ]);

    return {
      newUsers: users,
      newSalons: salons,
      newSubscriptions: subscriptions,
      completedPayments: payments,
      newReviews: reviews,
      totalVisits: visits,
    };
  }

  // Export methods

  private async exportToPDF(data: any, includeCharts?: boolean, template?: string): Promise<Buffer> {
    // TODO: Implement PDF export using pdfkit
    // For now, return JSON as text
    const jsonString = JSON.stringify(data, null, 2);
    return Buffer.from(jsonString, 'utf-8');
  }

  private async exportToExcel(data: any, includeCharts?: boolean): Promise<Buffer> {
    // TODO: Implement Excel export using exceljs
    // For now, return CSV format
    const csv = await this.exportToCSV(data);
    return Buffer.from(csv, 'utf-8');
  }

  private async exportToCSV(data: any): Promise<string> {
    if (!Array.isArray(data.data)) {
      return JSON.stringify(data);
    }

    const headers = Object.keys(data.data[0] || {});
    const rows = [
      headers.join(','),
      ...data.data.map((row: any) =>
        headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','),
      ),
    ];

    return rows.join('\n');
  }

  private async exportToJSON(data: any): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  // Helper methods

  private groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((result, item) => {
      const value = item[key];
      if (!result[value]) {
        result[value] = [];
      }
      result[value].push(item);
      return result;
    }, {});
  }
}

