import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

/**
 * Unified Payment History Service
 * يوفر سجل موحد لجميع المدفوعات مع إحصائيات شاملة
 */
@Injectable()
export class UnifiedPaymentHistoryService {
  private readonly logger = new Logger(UnifiedPaymentHistoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * الحصول على سجل المدفوعات الموحد
   */
  async getUnifiedPaymentHistory(options: {
    userId?: number;
    customerId?: number;
    salonId?: number;
    status?: PaymentStatus;
    paymentMethod?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      customerId,
      salonId,
      status,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options;

    const where: any = {};

    // فلترة حسب العميل
    if (customerId) {
      where.subscription = {
        customerId,
      };
    } else if (userId) {
      // إذا كان userId، نحتاج إلى العثور على customerId
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (customer) {
        where.subscription = {
          customerId: customer.id,
        };
      }
    }

    // فلترة حسب الصالون
    if (salonId) {
      where.subscription = {
        ...where.subscription,
        package: {
          salonId,
        },
      };
    }

    // فلترة حسب الحالة
    if (status) {
      where.status = status;
    }

    // فلترة حسب طريقة الدفع
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          subscription: {
            include: {
              customer: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
              package: {
                include: {
                  salon: {
                    select: {
                      id: true,
                      name: true,
                      logo: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * الحصول على إحصائيات شاملة للمدفوعات
   */
  async getComprehensiveStatistics(options: {
    userId?: number;
    customerId?: number;
    salonId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { userId, customerId, salonId, startDate, endDate } = options;

    const where: any = {};

    if (customerId) {
      where.subscription = {
        customerId,
      };
    } else if (userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (customer) {
        where.subscription = {
          customerId: customer.id,
        };
      }
    }

    if (salonId) {
      where.subscription = {
        ...where.subscription,
        package: {
          salonId,
        },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      totalRevenue,
      averagePayment,
      paymentsByMethod,
      paymentsByStatus,
      monthlyRevenue,
      recentPayments,
    ] = await Promise.all([
      // إجمالي المدفوعات
      this.prisma.payment.count({ where }),

      // المدفوعات المكتملة
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.COMPLETED },
      }),

      // المدفوعات المعلقة
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.PENDING },
      }),

      // المدفوعات الفاشلة
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.FAILED },
      }),

      // المدفوعات المستردة
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.REFUNDED },
      }),

      // إجمالي الإيرادات
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),

      // متوسط المدفوعات
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _avg: { amount: true },
      }),

      // المدفوعات حسب طريقة الدفع
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { paymentMethod: true },
        _sum: { amount: true },
      }),

      // المدفوعات حسب الحالة
      this.prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
        _sum: { amount: true },
      }),

      // الإيرادات الشهرية (آخر 12 شهر)
      this.getMonthlyRevenue(where),

      // آخر المدفوعات
      this.prisma.payment.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: {
              customer: {
                select: { fullName: true },
              },
              package: {
                include: {
                  salon: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      overview: {
        totalPayments,
        completedPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        averagePayment: averagePayment._avg.amount || 0,
        successRate: totalPayments > 0
          ? ((completedPayments / totalPayments) * 100).toFixed(2)
          : '0.00',
      },
      byMethod: paymentsByMethod.map((item) => ({
        method: item.paymentMethod,
        count: item._count.paymentMethod,
        totalAmount: item._sum.amount || 0,
      })),
      byStatus: paymentsByStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
        totalAmount: item._sum.amount || 0,
      })),
      monthlyRevenue,
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        customerName: payment.subscription.customer.fullName,
        salonName: payment.subscription.package.salon.name,
      })),
    };
  }

  /**
   * الحصول على الإيرادات الشهرية
   */
  private async getMonthlyRevenue(where: any) {
    const months: { month: string; revenue: number; count: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthWhere = {
        ...where,
        status: PaymentStatus.COMPLETED,
        createdAt: {
          gte: date,
          lt: nextMonth,
        },
      };

      const [revenue, count] = await Promise.all([
        this.prisma.payment.aggregate({
          where: monthWhere,
          _sum: { amount: true },
        }),
        this.prisma.payment.count({ where: monthWhere }),
      ]);

      months.push({
        month: date.toISOString().substring(0, 7), // YYYY-MM
        revenue: revenue._sum.amount || 0,
        count,
      });
    }

    return months;
  }

  /**
   * تصدير سجل المدفوعات
   */
  async exportPaymentHistory(
    options: {
      userId?: number;
      customerId?: number;
      salonId?: number;
      startDate?: Date;
      endDate?: Date;
    },
    format: 'json' | 'csv' = 'json',
  ) {
    const where: any = {};

    if (options.customerId) {
      where.subscription = {
        customerId: options.customerId,
      };
    } else if (options.userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: options.userId },
        select: { id: true },
      });
      if (customer) {
        where.subscription = {
          customerId: customer.id,
        };
      }
    }

    if (options.salonId) {
      where.subscription = {
        ...where.subscription,
        package: {
          salonId: options.salonId,
        },
      };
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        subscription: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return JSON.stringify(payments, null, 2);
    } else if (format === 'csv') {
      // تحويل إلى CSV
      const headers = [
        'ID',
        'Amount',
        'Currency',
        'Payment Method',
        'Status',
        'Customer Name',
        'Salon Name',
        'Date',
      ];
      const rows = payments.map((payment) => [
        payment.id.toString(),
        payment.amount.toString(),
        payment.currency,
        payment.paymentMethod,
        payment.status,
        payment.subscription.customer.fullName,
        payment.subscription.package.salon.name,
        payment.createdAt.toISOString(),
      ]);

      return [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}

