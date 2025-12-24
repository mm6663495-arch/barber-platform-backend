import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { Salon, Prisma } from '@prisma/client';
import { PaginationOptions, PaginatedResponseDto } from '../../common/dto/pagination.dto';

/**
 * Salon Repository
 * Repository للتعامل مع Salons في قاعدة البيانات
 */
@Injectable()
export class SalonRepository extends BaseRepository<Salon> {
  protected model: any;

  constructor(prisma: PrismaService) {
    super(prisma);
    this.model = prisma.salon;
  }

  /**
   * إيجاد صالونات بفلترة متقدمة مع Pagination
   */
  async findWithFilters(
    pagination: PaginationOptions,
    filters: {
      ownerId?: number;
      isActive?: boolean;
      isApproved?: boolean;
      search?: string;
      minRating?: number;
    },
  ): Promise<PaginatedResponseDto<Salon>> {
    const { skip, take, page, limit } = pagination;
    const where: Prisma.SalonWhereInput = {};

    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isApproved !== undefined) {
      where.isApproved = filters.isApproved;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { address: { contains: filters.search } },
      ];
    }

    if (filters.minRating) {
      where.rating = {
        gte: filters.minRating,
      };
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          packages: {
            where: { isActive: true, isPublished: true },
            select: {
              id: true,
              name: true,
              price: true,
              visitsCount: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              visits: true,
            },
          },
        },
        skip,
        take,
        orderBy: { rating: 'desc' },
      }),
      this.count(where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * البحث عن صالونات بالموقع الجغرافي
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    pagination: PaginationOptions,
  ): Promise<PaginatedResponseDto<Salon>> {
    // حساب مربع الحدود للبحث السريع
    const latDelta = radiusKm / 111; // 1 درجة = ~111 كم
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;

    const { skip, take, page, limit } = pagination;

    const where: Prisma.SalonWhereInput = {
      isActive: true,
      isApproved: true,
      latitude: {
        gte: minLat,
        lte: maxLat,
      },
      longitude: {
        gte: minLon,
        lte: maxLon,
      },
    };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
            },
          },
          packages: {
            where: { isActive: true, isPublished: true },
            orderBy: { price: 'asc' },
            take: 3,
          },
        },
        skip,
        take,
      }),
      this.count(where),
    ]);

    // حساب المسافة الفعلية وترتيب النتائج
    const salonsWithDistance = data.map((salon: any) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        salon.latitude,
        salon.longitude,
      );
      return { ...salon, distance };
    }).filter((salon: any) => salon.distance <= radiusKm)
      .sort((a: any, b: any) => a.distance - b.distance);

    return new PaginatedResponseDto(
      salonsWithDistance,
      salonsWithDistance.length,
      page,
      limit,
    );
  }

  /**
   * حساب المسافة بين نقطتين (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * إيجاد صالونات المالك
   */
  async findByOwnerId(
    ownerId: number,
    pagination: PaginationOptions,
  ): Promise<PaginatedResponseDto<Salon>> {
    return this.findWithFilters(pagination, { ownerId });
  }

  /**
   * إيجاد أفضل الصالونات
   */
  async findTopRated(
    pagination: PaginationOptions,
    minReviews: number = 5,
  ): Promise<PaginatedResponseDto<Salon>> {
    const { skip, take, page, limit } = pagination;

    const where: Prisma.SalonWhereInput = {
      isActive: true,
      isApproved: true,
      totalReviews: {
        gte: minReviews,
      },
    };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
            },
          },
          packages: {
            where: { isActive: true, isPublished: true },
            orderBy: { price: 'asc' },
            take: 3,
          },
        },
        orderBy: [
          { rating: 'desc' },
          { totalReviews: 'desc' },
        ],
        skip,
        take,
      }),
      this.count(where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * إحصائيات الصالون
   */
  async getStatistics(salonId: number): Promise<{
    totalVisits: number;
    totalSubscriptions: number;
    averageRating: number;
    totalReviews: number;
  }> {
    const salon = await this.model.findUnique({
      where: { id: salonId },
      select: {
        rating: true,
        totalReviews: true,
        _count: {
          select: {
            visits: true,
            packages: true,
          },
        },
      },
    });

    const totalSubscriptions = await this.prisma.subscription.count({
      where: {
        package: {
          salonId,
        },
      },
    });

    // ⭐ حساب الزيارات بدون الزيارات الملغية
    const totalVisits = await this.prisma.visit.count({
      where: {
        salonId,
        status: { not: 'CANCELLED' },
      },
    });

    return {
      totalVisits,
      totalSubscriptions,
      averageRating: salon?.rating || 0,
      totalReviews: salon?.totalReviews || 0,
    };
  }

  /**
   * تحديث تقييم الصالون
   */
  async updateRating(salonId: number): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: { salonId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      await this.model.update({
        where: { id: salonId },
        data: {
          rating: 0,
          totalReviews: 0,
        },
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await this.model.update({
      where: { id: salonId },
      data: {
        rating: Math.round(averageRating * 10) / 10, // تقريب لرقم عشري واحد
        totalReviews: reviews.length,
      },
    });
  }
}

