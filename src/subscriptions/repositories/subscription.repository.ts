import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { Subscription, SubscriptionStatus, Prisma } from '@prisma/client';
import { PaginationOptions, PaginatedResponseDto } from '../../common/dto/pagination.dto';

/**
 * Subscription Repository
 * Repository للتعامل مع Subscriptions في قاعدة البيانات
 */
@Injectable()
export class SubscriptionRepository extends BaseRepository<Subscription> {
  protected model: any;

  constructor(prisma: PrismaService) {
    super(prisma);
    this.model = prisma.subscription;
  }

  /**
   * إيجاد اشتراكات بفلترة متقدمة مع Pagination
   */
  async findWithFilters(
    pagination: PaginationOptions,
    filters: {
      customerId?: number;
      salonId?: number;
      status?: SubscriptionStatus;
    },
    include?: Prisma.SubscriptionInclude,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const { skip, take, page, limit } = pagination;
    const where: Prisma.SubscriptionWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.salonId) {
      where.package = {
        salonId: filters.salonId,
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        // استخدم select بدلاً من include لتجنّب محاولة Prisma لفك JSON فاسد (images/services)
        select: {
          id: true,
          customerId: true,
          packageId: true,
          qrCode: true,
          visitsUsed: true,
          visitsRemaining: true,
          startDate: true,
          endDate: true,
          status: true,
          autoRenewal: true,
          paymentMethod: true,
          paymentId: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          // نختار حقول آمنة فقط من package لنتجنب JSON fields
          package: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              visitsCount: true,
              validityDays: true,
              salon: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.count(where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * إيجاد اشتراك بواسطة QR Code
   */
  async findByQrCode(qrCode: string): Promise<Subscription | null> {
    return this.model.findUnique({
      where: { qrCode },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            profileImage: true,
          },
        },
        package: {
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * إيجاد اشتراكات العميل مع Pagination
   */
  async findByCustomerId(
    customerId: number,
    pagination: PaginationOptions,
    status?: SubscriptionStatus,
  ): Promise<PaginatedResponseDto<Subscription>> {
    return this.findWithFilters(pagination, { customerId, status });
  }

  /**
   * إيجاد اشتراكات الصالون مع Pagination
   */
  async findBySalonId(
    salonId: number,
    pagination: PaginationOptions,
    status?: SubscriptionStatus,
  ): Promise<PaginatedResponseDto<Subscription>> {
    return this.findWithFilters(pagination, { salonId, status });
  }

  /**
   * إحصائيات الاشتراكات
   */
  async getStatistics(filters: {
    customerId?: number;
    salonId?: number;
  }): Promise<{
    total: number;
    active: number;
    expired: number;
    cancelled: number;
  }> {
    const where: Prisma.SubscriptionWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.salonId) {
      where.package = {
        salonId: filters.salonId,
      };
    }

    const [total, active, expired, cancelled] = await Promise.all([
      this.count(where),
      this.count({ ...where, status: SubscriptionStatus.ACTIVE }),
      this.count({ ...where, status: SubscriptionStatus.EXPIRED }),
      this.count({ ...where, status: SubscriptionStatus.CANCELLED }),
    ]);

    return { total, active, expired, cancelled };
  }

  /**
   * إيجاد الاشتراكات المنتهية التي تحتاج تحديث
   */
  async findExpiredSubscriptions(): Promise<Subscription[]> {
    return this.model.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * إيجاد الاشتراكات القريبة من الانتهاء
   */
  async findExpiringSubscriptions(daysBeforeExpiry: number): Promise<Subscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

    return this.model.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lte: futureDate,
          gte: new Date(),
        },
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
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

  /**
   * تحديث حالة الاشتراكات المنتهية
   */
  async updateExpiredSubscriptions(subscriptionIds: number[]): Promise<number> {
    const result = await this.model.updateMany({
      where: {
        id: {
          in: subscriptionIds,
        },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    return result.count;
  }

  /**
   * إيجاد اشتراك بالتفاصيل الكاملة
   */
  async findByIdWithDetails(id: number): Promise<Subscription | null> {
    return this.model.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            profileImage: true,
          },
        },
        package: {
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                address: true,
                logo: true,
              },
            },
          },
        },
        visits: {
          orderBy: { createdAt: 'desc' },
          include: {
            review: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}

