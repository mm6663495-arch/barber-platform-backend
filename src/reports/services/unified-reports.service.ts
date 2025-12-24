import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportStatus, ReportType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unified Reports Service
 * خدمة التقارير الموحدة - تقارير شاملة لجميع جوانب النظام
 */
@Injectable()
export class UnifiedReportsService {
  private readonly logger = new Logger(UnifiedReportsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * الحصول على تقرير شامل للنظام
   */
  async getComprehensiveReport(options?: {
    startDate?: Date;
    endDate?: Date;
    includeUsers?: boolean;
    includeSalons?: boolean;
    includeSubscriptions?: boolean;
    includePayments?: boolean;
    includeReviews?: boolean;
    includeReports?: boolean;
  }) {
    const {
      startDate,
      endDate,
      includeUsers = true,
      includeSalons = true,
      includeSubscriptions = true,
      includePayments = true,
      includeReviews = true,
      includeReports = true,
    } = options || {};

    const dateFilter = this.buildDateFilter(startDate, endDate);

    const [
      usersReport,
      salonsReport,
      subscriptionsReport,
      paymentsReport,
      reviewsReport,
      reportsReport,
      systemHealth,
    ] = await Promise.all([
      includeUsers ? this.getUsersReport(dateFilter) : null,
      includeSalons ? this.getSalonsReport(dateFilter) : null,
      includeSubscriptions ? this.getSubscriptionsReport(dateFilter) : null,
      includePayments ? this.getPaymentsReport(dateFilter) : null,
      includeReviews ? this.getReviewsReport(dateFilter) : null,
      includeReports ? this.getReportsReport(dateFilter) : null,
      this.getSystemHealthReport(),
    ]);

    return {
      period: {
        startDate: startDate || null,
        endDate: endDate || new Date(),
      },
      generatedAt: new Date(),
      users: usersReport,
      salons: salonsReport,
      subscriptions: subscriptionsReport,
      payments: paymentsReport,
      reviews: reviewsReport,
      reports: reportsReport,
      systemHealth,
      summary: this.generateSummary({
        users: usersReport,
        salons: salonsReport,
        subscriptions: subscriptionsReport,
        payments: paymentsReport,
        reviews: reviewsReport,
        reports: reportsReport,
      }),
    };
  }

  /**
   * تقرير المستخدمين
   */
  private async getUsersReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalUsers,
      newUsers,
      activeUsers,
      customers,
      salonOwners,
      admins,
      usersByMonth,
      topActiveUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { ...where, isActive: true } }),
      this.prisma.user.count({ where: { ...where, role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { ...where, role: 'SALON_OWNER' } }),
      this.prisma.user.count({ where: { ...where, role: 'ADMIN' } }),
      this.getUsersByMonth(where),
      this.getTopActiveUsers(where),
    ]);

    return {
      totalUsers,
      newUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      byRole: {
        customers,
        salonOwners,
        admins,
      },
      monthlyTrend: usersByMonth,
      topActiveUsers,
    };
  }

  /**
   * تقرير الصالونات
   */
  private async getSalonsReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalSalons,
      newSalons,
      activeSalons,
      approvedSalons,
      pendingSalons,
      suspendedSalons,
      salonsByMonth,
      topRatedSalons,
    ] = await Promise.all([
      this.prisma.salon.count(),
      this.prisma.salon.count({ where }),
      this.prisma.salon.count({ where: { ...where, isActive: true } }),
      this.prisma.salon.count({
        where: { ...where, isApproved: true, isActive: true },
      }),
      this.prisma.salon.count({
        where: { ...where, isApproved: false },
      }),
      this.prisma.salon.count({
        where: { ...where, isActive: false },
      }),
      this.getSalonsByMonth(where),
      this.getTopRatedSalons(10),
    ]);

    return {
      totalSalons,
      newSalons,
      activeSalons,
      approvedSalons,
      pendingSalons,
      suspendedSalons,
      monthlyTrend: salonsByMonth,
      topRatedSalons,
    };
  }

  /**
   * تقرير الاشتراكات
   */
  private async getSubscriptionsReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalSubscriptions,
      newSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      subscriptionsByMonth,
      subscriptionsByStatus,
    ] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.count({
        where: { ...where, status: 'ACTIVE' },
      }),
      this.prisma.subscription.count({
        where: { ...where, status: 'EXPIRED' },
      }),
      this.prisma.subscription.count({
        where: { ...where, status: 'CANCELLED' },
      }),
      this.getSubscriptionsByMonth(where),
      this.getSubscriptionsByStatus(where),
    ]);

    return {
      totalSubscriptions,
      newSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      monthlyTrend: subscriptionsByMonth,
      byStatus: subscriptionsByStatus,
    };
  }

  /**
   * تقرير المدفوعات
   */
  private async getPaymentsReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue,
      averagePayment,
      paymentsByMonth,
      paymentsByMethod,
    ] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      this.prisma.payment.count({
        where: { ...where, status: 'PENDING' },
      }),
      this.prisma.payment.count({
        where: { ...where, status: 'FAILED' },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _avg: { amount: true },
      }),
      this.getPaymentsByMonth(where),
      this.getPaymentsByMethod(where),
    ]);

    return {
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      averagePayment: averagePayment._avg.amount || 0,
      monthlyTrend: paymentsByMonth,
      byMethod: paymentsByMethod,
    };
  }

  /**
   * تقرير التقييمات
   */
  private async getReviewsReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalReviews,
      averageRating,
      reviewsByRating,
      reportedReviews,
      reviewsWithResponse,
      reviewsByMonth,
    ] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
      this.prisma.review.count({
        where: { ...where, isReported: true },
      }),
      this.prisma.review.count({
        where: { ...where, response: { not: null } },
      }),
      this.getReviewsByMonth(where),
    ]);

    return {
      totalReviews,
      averageRating: averageRating._avg.rating || 0,
      byRating: reviewsByRating.map((item) => ({
        rating: item.rating,
        count: item._count.rating,
      })),
      reportedReviews,
      reviewsWithResponse,
      reviewsWithoutResponse: totalReviews - reviewsWithResponse,
      monthlyTrend: reviewsByMonth,
    };
  }

  /**
   * تقرير البلاغات
   */
  private async getReportsReport(dateFilter: any) {
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalReports,
      pendingReports,
      reviewedReports,
      resolvedReports,
      reportsByType,
      reportsByMonth,
    ] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.count({
        where: { ...where, status: 'PENDING' },
      }),
      this.prisma.report.count({
        where: { ...where, status: 'REVIEWED' },
      }),
      this.prisma.report.count({
        where: { ...where, status: 'RESOLVED' },
      }),
      this.prisma.report.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
      this.getReportsByMonth(where),
    ]);

    return {
      totalReports,
      pendingReports,
      reviewedReports,
      resolvedReports,
      byType: reportsByType.map((item) => ({
        type: item.type,
        count: item._count.type,
      })),
      monthlyTrend: reportsByMonth,
    };
  }

  /**
   * تقرير صحة النظام
   */
  private async getSystemHealthReport() {
    const [
      totalUsers,
      activeUsers,
      totalSalons,
      activeSalons,
      totalSubscriptions,
      activeSubscriptions,
      totalPayments,
      completedPayments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.salon.count(),
      this.prisma.salon.count({ where: { isActive: true } }),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.count(),
      this.prisma.payment.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        health: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      },
      salons: {
        total: totalSalons,
        active: activeSalons,
        health: totalSalons > 0 ? (activeSalons / totalSalons) * 100 : 0,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        health:
          totalSubscriptions > 0
            ? (activeSubscriptions / totalSubscriptions) * 100
            : 0,
      },
      payments: {
        total: totalPayments,
        completed: completedPayments,
        successRate:
          totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0,
      },
    };
  }

  /**
   * توليد ملخص شامل
   */
  private generateSummary(reports: any) {
    return {
      totalUsers: reports.users?.totalUsers || 0,
      totalSalons: reports.salons?.totalSalons || 0,
      totalSubscriptions: reports.subscriptions?.totalSubscriptions || 0,
      totalRevenue: reports.payments?.totalRevenue || 0,
      totalReviews: reports.reviews?.totalReviews || 0,
      totalReports: reports.reports?.totalReports || 0,
      keyMetrics: {
        userGrowth: reports.users?.newUsers || 0,
        salonGrowth: reports.salons?.newSalons || 0,
        revenueGrowth: reports.payments?.totalRevenue || 0,
        reviewGrowth: reports.reviews?.totalReviews || 0,
      },
    };
  }

  // Helper methods for monthly trends
  private async getUsersByMonth(where: any) {
    return this.getMonthlyData('user', where);
  }

  private async getSalonsByMonth(where: any) {
    return this.getMonthlyData('salon', where);
  }

  private async getSubscriptionsByMonth(where: any) {
    return this.getMonthlyData('subscription', where);
  }

  private async getPaymentsByMonth(where: any) {
    return this.getMonthlyData('payment', where);
  }

  private async getReviewsByMonth(where: any) {
    return this.getMonthlyData('review', where);
  }

  private async getReportsByMonth(where: any) {
    return this.getMonthlyData('report', where);
  }

  private async getMonthlyData(entity: string, baseWhere: any) {
    const months: { month: string; count: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthWhere = {
        ...baseWhere,
        createdAt: {
          gte: date,
          lt: nextMonth,
        },
      };

      let count = 0;
      switch (entity) {
        case 'user':
          count = await this.prisma.user.count({ where: monthWhere });
          break;
        case 'salon':
          count = await this.prisma.salon.count({ where: monthWhere });
          break;
        case 'subscription':
          count = await this.prisma.subscription.count({ where: monthWhere });
          break;
        case 'payment':
          count = await this.prisma.payment.count({ where: monthWhere });
          break;
        case 'review':
          count = await this.prisma.review.count({ where: monthWhere });
          break;
        case 'report':
          count = await this.prisma.report.count({ where: monthWhere });
          break;
      }

      months.push({
        month: date.toISOString().substring(0, 7),
        count,
      });
    }

    return months;
  }

  private async getTopActiveUsers(where: any) {
    // يمكن إضافة منطق أكثر تعقيداً هنا
    return [];
  }

  private async getTopRatedSalons(limit: number) {
    const salonRatings = await this.prisma.review.groupBy({
      by: ['salonId'],
      _avg: { rating: true },
      _count: { rating: true },
      orderBy: { _avg: { rating: 'desc' } },
      take: limit,
    });

    const salonIds = salonRatings.map((sr) => sr.salonId);
    const salons = await this.prisma.salon.findMany({
      where: { id: { in: salonIds } },
      select: {
        id: true,
        name: true,
        logo: true,
      },
    });

    return salonRatings.map((sr) => {
      const salon = salons.find((s) => s.id === sr.salonId);
      return {
        salonId: sr.salonId,
        salonName: salon?.name || 'Unknown',
        averageRating: sr._avg.rating || 0,
        reviewCount: sr._count.rating,
      };
    });
  }

  private async getSubscriptionsByStatus(where: any) {
    const statuses = await this.prisma.subscription.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    return statuses.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));
  }

  private async getPaymentsByMethod(where: any) {
    const methods = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where,
      _count: { paymentMethod: true },
      _sum: { amount: true },
    });

    return methods.map((item) => ({
      method: item.paymentMethod,
      count: item._count.paymentMethod,
      totalAmount: item._sum.amount || 0,
    }));
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) return null;

    const filter: any = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;

    return filter;
  }

  /**
   * تصدير التقرير بصيغة PDF
   */
  async exportToPDF(
    report: any,
    options?: { filename?: string },
  ): Promise<string> {
    const doc = new PDFDocument();
    const filename =
      options?.filename ||
      `report_${new Date().toISOString().split('T')[0]}.pdf`;
    const filepath = path.join(process.cwd(), 'temp', filename);

    // إنشاء مجلد temp إذا لم يكن موجوداً
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // كتابة التقرير إلى PDF
    doc.pipe(fs.createWriteStream(filepath));

    // العنوان
    doc.fontSize(20).text('تقرير شامل للنظام', { align: 'center' });
    doc.moveDown();

    // معلومات الفترة
    if (report.period) {
      doc.fontSize(12).text('الفترة:', { continued: true });
      doc.text(
        `${report.period.startDate || 'بداية'} - ${report.period.endDate || 'نهاية'}`,
      );
      doc.moveDown();
    }

    // الملخص
    if (report.summary) {
      doc.fontSize(16).text('الملخص', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`إجمالي المستخدمين: ${report.summary.totalUsers}`);
      doc.text(`إجمالي الصالونات: ${report.summary.totalSalons}`);
      doc.text(`إجمالي الاشتراكات: ${report.summary.totalSubscriptions}`);
      doc.text(`إجمالي الإيرادات: ${report.summary.totalRevenue}`);
      doc.text(`إجمالي التقييمات: ${report.summary.totalReviews}`);
      doc.text(`إجمالي البلاغات: ${report.summary.totalReports}`);
      doc.moveDown();
    }

    // تفاصيل المستخدمين
    if (report.users) {
      doc.fontSize(16).text('المستخدمين', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`إجمالي المستخدمين: ${report.users.totalUsers}`);
      doc.text(`المستخدمين الجدد: ${report.users.newUsers}`);
      doc.text(`المستخدمين النشطين: ${report.users.activeUsers}`);
      doc.moveDown();
    }

    // تفاصيل الصالونات
    if (report.salons) {
      doc.fontSize(16).text('الصالونات', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`إجمالي الصالونات: ${report.salons.totalSalons}`);
      doc.text(`الصالونات الجديدة: ${report.salons.newSalons}`);
      doc.text(`الصالونات النشطة: ${report.salons.activeSalons}`);
      doc.moveDown();
    }

    // تفاصيل المدفوعات
    if (report.payments) {
      doc.fontSize(16).text('المدفوعات', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`إجمالي المدفوعات: ${report.payments.totalPayments}`);
      doc.text(`المدفوعات المكتملة: ${report.payments.completedPayments}`);
      doc.text(`إجمالي الإيرادات: ${report.payments.totalRevenue}`);
      doc.moveDown();
    }

    // التاريخ
    doc.fontSize(10).text(
      `تم الإنشاء: ${new Date().toLocaleString('ar-SA')}`,
      { align: 'right' },
    );

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(filepath));
      doc.on('error', reject);
    });
  }

  /**
   * تصدير التقرير بصيغة Excel
   */
  async exportToExcel(
    report: any,
    options?: { filename?: string },
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const filename =
      options?.filename ||
      `report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filepath = path.join(process.cwd(), 'temp', filename);

    // إنشاء مجلد temp إذا لم يكن موجوداً
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // ورقة الملخص
    const summarySheet = workbook.addWorksheet('الملخص');
    if (report.summary) {
      summarySheet.addRow(['المقياس', 'القيمة']);
      summarySheet.addRow(['إجمالي المستخدمين', report.summary.totalUsers]);
      summarySheet.addRow(['إجمالي الصالونات', report.summary.totalSalons]);
      summarySheet.addRow([
        'إجمالي الاشتراكات',
        report.summary.totalSubscriptions,
      ]);
      summarySheet.addRow(['إجمالي الإيرادات', report.summary.totalRevenue]);
      summarySheet.addRow(['إجمالي التقييمات', report.summary.totalReviews]);
      summarySheet.addRow(['إجمالي البلاغات', report.summary.totalReports]);
    }

    // ورقة المستخدمين
    if (report.users) {
      const usersSheet = workbook.addWorksheet('المستخدمين');
      usersSheet.addRow(['المقياس', 'القيمة']);
      usersSheet.addRow(['إجمالي المستخدمين', report.users.totalUsers]);
      usersSheet.addRow(['المستخدمين الجدد', report.users.newUsers]);
      usersSheet.addRow(['المستخدمين النشطين', report.users.activeUsers]);
    }

    // ورقة الصالونات
    if (report.salons) {
      const salonsSheet = workbook.addWorksheet('الصالونات');
      salonsSheet.addRow(['المقياس', 'القيمة']);
      salonsSheet.addRow(['إجمالي الصالونات', report.salons.totalSalons]);
      salonsSheet.addRow(['الصالونات الجديدة', report.salons.newSalons]);
      salonsSheet.addRow(['الصالونات النشطة', report.salons.activeSalons]);
    }

    // ورقة المدفوعات
    if (report.payments) {
      const paymentsSheet = workbook.addWorksheet('المدفوعات');
      paymentsSheet.addRow(['المقياس', 'القيمة']);
      paymentsSheet.addRow([
        'إجمالي المدفوعات',
        report.payments.totalPayments,
      ]);
      paymentsSheet.addRow([
        'المدفوعات المكتملة',
        report.payments.completedPayments,
      ]);
      paymentsSheet.addRow(['إجمالي الإيرادات', report.payments.totalRevenue]);
    }

    await workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  /**
   * تصدير التقرير بصيغة CSV
   */
  async exportToCSV(
    report: any,
    options?: { filename?: string },
  ): Promise<string> {
    const filename =
      options?.filename ||
      `report_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(process.cwd(), 'temp', filename);

    // إنشاء مجلد temp إذا لم يكن موجوداً
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const lines: string[] = [];

    // العنوان
    lines.push('تقرير شامل للنظام');
    lines.push('');

    // الملخص
    if (report.summary) {
      lines.push('الملخص');
      lines.push('المقياس,القيمة');
      lines.push(`إجمالي المستخدمين,${report.summary.totalUsers}`);
      lines.push(`إجمالي الصالونات,${report.summary.totalSalons}`);
      lines.push(
        `إجمالي الاشتراكات,${report.summary.totalSubscriptions}`,
      );
      lines.push(`إجمالي الإيرادات,${report.summary.totalRevenue}`);
      lines.push(`إجمالي التقييمات,${report.summary.totalReviews}`);
      lines.push(`إجمالي البلاغات,${report.summary.totalReports}`);
      lines.push('');
    }

    // المستخدمين
    if (report.users) {
      lines.push('المستخدمين');
      lines.push('المقياس,القيمة');
      lines.push(`إجمالي المستخدمين,${report.users.totalUsers}`);
      lines.push(`المستخدمين الجدد,${report.users.newUsers}`);
      lines.push(`المستخدمين النشطين,${report.users.activeUsers}`);
      lines.push('');
    }

    // الصالونات
    if (report.salons) {
      lines.push('الصالونات');
      lines.push('المقياس,القيمة');
      lines.push(`إجمالي الصالونات,${report.salons.totalSalons}`);
      lines.push(`الصالونات الجديدة,${report.salons.newSalons}`);
      lines.push(`الصالونات النشطة,${report.salons.activeSalons}`);
      lines.push('');
    }

    // المدفوعات
    if (report.payments) {
      lines.push('المدفوعات');
      lines.push('المقياس,القيمة');
      lines.push(`إجمالي المدفوعات,${report.payments.totalPayments}`);
      lines.push(
        `المدفوعات المكتملة,${report.payments.completedPayments}`,
      );
      lines.push(`إجمالي الإيرادات,${report.payments.totalRevenue}`);
      lines.push('');
    }

    // التاريخ
    lines.push(`تم الإنشاء,${new Date().toLocaleString('ar-SA')}`);

    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    return filepath;
  }

  /**
   * تصدير التقرير بصيغة JSON
   */
  async exportToJSON(
    report: any,
    options?: { filename?: string },
  ): Promise<string> {
    const filename =
      options?.filename ||
      `report_${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(process.cwd(), 'temp', filename);

    // إنشاء مجلد temp إذا لم يكن موجوداً
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(
      filepath,
      JSON.stringify(report, null, 2),
      'utf8',
    );
    return filepath;
  }
}

