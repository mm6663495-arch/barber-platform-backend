import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { UsersService } from '../users/users.service';
import { SalonsService } from '../salons/salons.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';
import { ReviewsService } from '../reviews/reviews.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private salonsService: SalonsService,
    private subscriptionsService: SubscriptionsService,
    private paymentsService: PaymentsService,
    private reviewsService: ReviewsService,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStatistics() {
    const [
      userStats,
      salonStats,
      subscriptionStats,
      paymentStats,
      reviewStats,
      notificationStats,
    ] = await Promise.all([
      this.usersService.getStatistics(),
      this.getSalonStatistics(),
      this.subscriptionsService.getSubscriptionStatistics(),
      this.paymentsService.getPaymentStatistics(),
      this.reviewsService.getReviewStatistics(),
      this.notificationsService.getNotificationStatistics(),
    ]);

    // حساب المدفوعات المعلقة والإيرادات الشهرية
    const [pendingPaymentsData, monthlyRevenueData] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      users: userStats,
      salons: salonStats,
      subscriptions: subscriptionStats,
      payments: {
        ...paymentStats,
        // بيانات إضافية للـ Billing Screen
        totalRevenue: paymentStats.totalRevenue || 0,
        pendingAmount: pendingPaymentsData._sum.amount || 0,
        pendingCount: pendingPaymentsData._count.id || 0,
        monthlyRevenue: monthlyRevenueData._sum.amount || 0,
        fees: 0, // يمكن حسابها لاحقاً إذا كان هناك نظام رسوم
      },
      reviews: reviewStats,
      notifications: notificationStats,
    };
  }

  async getSalonStatistics() {
    const [
      totalSalons,
      approvedSalons,
      pendingSalons,
      activeSalons,
      inactiveSalons,
      totalPackages,
      publishedPackages,
    ] = await Promise.all([
      this.prisma.salon.count(),
      this.prisma.salon.count({ where: { isApproved: true } }),
      this.prisma.salon.count({ where: { isApproved: false, isActive: true } }),
      this.prisma.salon.count({ where: { isActive: true, isApproved: true } }),
      this.prisma.salon.count({ where: { isActive: false } }),
      this.prisma.package.count(),
      this.prisma.package.count({ where: { isPublished: true, isActive: true } }),
    ]);

    return {
      totalSalons,
      approvedSalons,
      pendingSalons,
      activeSalons,
      inactiveSalons,
      totalPackages,
      publishedPackages,
    };
  }

  async getRecentActivity(limit = 20) {
    const [
      recentUsers,
      recentSalons,
      recentSubscriptions,
      recentPayments,
      recentReviews,
    ] = await Promise.all([
      this.usersService.getRecentUsers(limit),
      this.getRecentSalons(limit),
      this.getRecentSubscriptions(limit),
      this.paymentsService.getRecentPayments(limit),
      this.reviewsService.getRecentReviews(limit),
    ]);

    return {
      recentUsers,
      recentSalons,
      recentSubscriptions,
      recentPayments,
      recentReviews,
    };
  }

  async getRecentSalons(limit = 10) {
    return this.prisma.salon.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            fullName: true,
            phone: true,
          },
        },
        _count: {
          select: {
            packages: true,
            reviews: true,
          },
        },
      },
    });
  }

  async getRecentSubscriptions(limit = 10) {
    return this.prisma.subscription.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            fullName: true,
            phone: true,
          },
        },
        package: {
          include: {
            salon: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getPendingApprovals() {
    const [pendingSalons, pendingReports] = await Promise.all([
      this.prisma.salon.findMany({
        where: { isApproved: false, isActive: true },
        include: {
          owner: {
            select: {
              phone: true,
              subscriptionStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.report.findMany({
        where: { status: 'PENDING' },
        include: {
          reporter: {
            select: {
              email: true,
            },
          },
          reportedUser: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      pendingSalons,
      pendingReports,
    };
  }

  async getRevenueAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30 * 7);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        break;
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        amount: true,
        createdAt: true,
        subscription: {
          include: {
            package: {
              include: {
                salon: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by period
    const groupedRevenue = this.groupRevenueByPeriod(payments, period);

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const averageRevenue = payments.length > 0 ? totalRevenue / payments.length : 0;

    return {
      period,
      totalRevenue,
      averageRevenue,
      paymentCount: payments.length,
      groupedRevenue,
      payments: payments.slice(0, 20), // Recent payments
    };
  }

  private groupRevenueByPeriod(payments: any[], period: string) {
    const groups: Record<string, { revenue: number; count: number }> = {};

    payments.forEach(payment => {
      let key: string;
      const date = new Date(payment.createdAt);

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groups[key]) {
        groups[key] = { revenue: 0, count: 0 };
      }

      groups[key].revenue += payment.amount;
      groups[key].count += 1;
    });

    return Object.entries(groups)
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getUserAnalytics() {
    const [
      totalUsers,
      activeUsers,
      userGrowth,
      userDistribution,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.getUserGrowth(),
      this.getUserDistribution(),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      userGrowth,
      userDistribution,
    };
  }

  private async getUserGrowth() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

    const users = await this.prisma.user.findMany({
      where: {
        createdAt: {
          gte: twelveMonthsAgo,
        },
      },
      select: {
        createdAt: true,
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyGrowth: Record<string, { total: number; admins: number; salonOwners: number; customers: number }> = {};

    users.forEach(user => {
      const monthKey = `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyGrowth[monthKey]) {
        monthlyGrowth[monthKey] = { total: 0, admins: 0, salonOwners: 0, customers: 0 };
      }

      monthlyGrowth[monthKey].total += 1;
      if (user.role === 'ADMIN') monthlyGrowth[monthKey].admins += 1;
      else if (user.role === 'SALON_OWNER') monthlyGrowth[monthKey].salonOwners += 1;
      else if (user.role === 'CUSTOMER') monthlyGrowth[monthKey].customers += 1;
    });

    return Object.entries(monthlyGrowth)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private async getUserDistribution() {
    const distribution = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });

    return distribution.map(item => ({
      role: item.role,
      count: item._count.role,
    }));
  }

  async getSystemHealth() {
    const [
      databaseStatus,
      activeConnections,
      errorCount,
      performanceMetrics,
    ] = await Promise.all([
      this.checkDatabaseHealth(),
      this.getActiveConnections(),
      this.getErrorCount(),
      this.getPerformanceMetrics(),
    ]);

    return {
      database: databaseStatus,
      activeConnections,
      errors: errorCount,
      performance: performanceMetrics,
      timestamp: new Date(),
    };
  }

  // ===== JSON Health and Repair =====
  async getJsonHealth() {
    const counts = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 'Salon' AS tableName,
             SUM(CASE WHEN JSON_VALID(images)=0 OR images IS NULL THEN 1 ELSE 0 END) AS bad_images,
             SUM(CASE WHEN JSON_VALID(workingHours)=0 OR workingHours IS NULL THEN 1 ELSE 0 END) AS bad_workingHours
      FROM Salon
      UNION ALL
      SELECT 'Package',
             SUM(CASE WHEN JSON_VALID(images)=0 OR images IS NULL THEN 1 ELSE 0 END),
             SUM(CASE WHEN JSON_VALID(services)=0 OR services IS NULL THEN 1 ELSE 0 END)
      FROM Package
    `).catch(() => []);

    return {
      success: true,
      data: counts,
      timestamp: new Date(),
    };
  }

  async repairJson() {
    const ops: { query: string; ok: boolean }[] = [];
    const exec = async (q: string) => {
      try {
        await this.prisma.$executeRawUnsafe(q);
        ops.push({ query: q, ok: true });
      } catch (e) {
        ops.push({ query: q, ok: false });
      }
    };

    // Cleanup invalid JSON
    await exec(`UPDATE Salon SET images='[]' WHERE images IS NULL OR JSON_VALID(images)=0;`);
    await exec(`UPDATE Salon SET workingHours='{}' WHERE workingHours IS NULL OR JSON_VALID(workingHours)=0;`);
    await exec(`UPDATE Package SET images='[]' WHERE images IS NULL OR JSON_VALID(images)=0;`);
    await exec(`UPDATE Package SET services='[]' WHERE services IS NULL OR JSON_VALID(services)=0;`);

    // Return a summary
    const health = await this.getJsonHealth();
    return { success: true, ops, health };
  }

  private async checkDatabaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', responseTime: '< 100ms' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  private async getActiveConnections() {
    // This would typically come from a monitoring service
    return {
      count: 0,
      maxConnections: 100,
    };
  }

  private async getErrorCount() {
    // This would typically come from error tracking
    return {
      last24h: 0,
      last7d: 0,
      critical: 0,
    };
  }

  private async getPerformanceMetrics() {
    // This would typically come from performance monitoring
    return {
      averageResponseTime: '< 200ms',
      uptime: '99.9%',
      memoryUsage: '45%',
      cpuUsage: '30%',
    };
  }

  async generateReport(type: 'users' | 'salons' | 'payments' | 'reviews', period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    switch (type) {
      case 'users':
        return this.generateUserReport(startDate, now);
      case 'salons':
        return this.generateSalonReport(startDate, now);
      case 'payments':
        return this.generatePaymentReport(startDate, now);
      case 'reviews':
        return this.generateReviewReport(startDate, now);
      default:
        throw new Error('Invalid report type');
    }
  }

  private async generateUserReport(startDate: Date, endDate: Date) {
    const [
      newUsers,
      userDistribution,
      userActivity,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          platformAdmin: true,
          salonOwner: true,
          customer: true,
        },
      }),
      this.getUserDistribution(),
      this.prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    return {
      type: 'users',
      period: { startDate, endDate },
      newUsers: newUsers.length,
      userDistribution,
      userActivity,
      users: newUsers,
    };
  }

  private async generateSalonReport(startDate: Date, endDate: Date) {
    const [
      newSalons,
      approvedSalons,
      salonStats,
    ] = await Promise.all([
      this.prisma.salon.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          owner: true,
          _count: {
            select: {
              packages: true,
              reviews: true,
              visits: true,
            },
          },
        },
      }),
      this.prisma.salon.findMany({
        where: {
          isApproved: true,
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.getSalonStatistics(),
    ]);

    return {
      type: 'salons',
      period: { startDate, endDate },
      newSalons: newSalons.length,
      approvedSalons: approvedSalons.length,
      salonStats,
      salons: newSalons,
    };
  }

  private async generatePaymentReport(startDate: Date, endDate: Date) {
    const [
      payments,
      revenue,
      paymentMethods,
    ] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          subscription: {
            include: {
              package: {
                include: {
                  salon: true,
                },
              },
            },
          },
        },
      }),
      this.paymentsService.getPaymentStatistics(),
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: { paymentMethod: true },
      }),
    ]);

    return {
      type: 'payments',
      period: { startDate, endDate },
      totalPayments: payments.length,
      totalRevenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
      revenue,
      paymentMethods,
      payments: payments.slice(0, 50), // Limit for performance
    };
  }

  // ==========================================
  // Reports Management
  // ==========================================

  async getReports(
    page: number = 1,
    limit: number = 10,
    status?: string,
    type?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              customer: {
                select: {
                  fullName: true,
                  phone: true,
                  profileImage: true,
                },
              },
              salonOwner: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
          reportedUser: {
            select: {
              id: true,
              email: true,
              customer: {
                select: {
                  fullName: true,
                  phone: true,
                  profileImage: true,
                },
              },
              salonOwner: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveReport(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Report resolved successfully',
      data: updated,
    };
  }

  async rejectReport(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Report rejected successfully',
      data: updated,
    };
  }

  async approveReview(id: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // إزالة البلاغ من التقييم (إذا كان موجوداً)
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        isReported: false,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Review approved successfully',
      data: updated,
    };
  }

  private async generateReviewReport(startDate: Date, endDate: Date) {
    const [
      reviews,
      reviewStats,
      topSalons,
    ] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          customer: true,
          salon: true,
        },
      }),
      this.reviewsService.getReviewStatistics(),
      this.prisma.salon.findMany({
        where: {
          isActive: true,
          isApproved: true,
        },
        orderBy: { rating: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          rating: true,
          totalReviews: true,
        },
      }),
    ]);

    return {
      type: 'reviews',
      period: { startDate, endDate },
      totalReviews: reviews.length,
      reviewStats,
      topSalons,
      reviews: reviews.slice(0, 50), // Limit for performance
    };
  }

  // ==========================================
  // Billing Management
  // ==========================================

  async getPayments(
    page: number = 1,
    limit: number = 10,
    status?: string,
    method?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // فلترة حسب الحالة
    if (status) {
      where.status = status;
    }

    // فلترة حسب طريقة الدفع
    if (method) {
      where.paymentMethod = method;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          subscription: {
            include: {
              customer: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              package: {
                include: {
                  salon: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoices(
    page: number = 1,
    limit: number = 10,
    status?: string,
    startDate?: string,
    endDate?: string,
  ) {
    // استخدام Payments كـ Invoices
    // تحويل status من Invoice format إلى Payment format
    let paymentStatus: string | undefined;
    if (status) {
      switch (status.toUpperCase()) {
        case 'PAID':
          paymentStatus = 'COMPLETED';
          break;
        case 'PENDING':
          paymentStatus = 'PENDING';
          break;
        case 'OVERDUE':
          paymentStatus = 'FAILED';
          break;
        default:
          paymentStatus = status;
      }
    }

    const paymentsData = await this.getPayments(
      page,
      limit,
      paymentStatus,
      undefined,
      startDate,
      endDate,
    );

    // تحويل Payments إلى Invoices format
    const invoices = paymentsData.payments.map((payment: any) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status:
        payment.status === 'COMPLETED'
          ? 'PAID'
          : payment.status === 'PENDING'
            ? 'PENDING'
            : payment.status === 'FAILED'
              ? 'OVERDUE'
              : 'PENDING',
      createdAt: payment.createdAt,
      dueDate: payment.subscription?.endDate || null,
      paidAt:
        payment.status === 'COMPLETED' ? payment.updatedAt : null,
      salon: payment.subscription?.package?.salon || null,
      salonName: payment.subscription?.package?.salon?.name || null,
      customer: payment.subscription?.customer || null,
      customerName: payment.subscription?.customer?.fullName || null,
      subscription: payment.subscription
        ? {
            id: payment.subscription.id,
            packageId: payment.subscription.packageId,
          }
        : null,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
    }));

    return {
      invoices,
      pagination: paymentsData.pagination,
    };
  }
}
