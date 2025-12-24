import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Reviews Monitoring Service
 * خدمة مراقبة التقييمات المتقدمة للمسؤولين
 */
@Injectable()
export class ReviewsMonitoringService {
  private readonly logger = new Logger(ReviewsMonitoringService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * الحصول على إحصائيات شاملة للتقييمات
   */
  async getComprehensiveStatistics(options?: {
    salonId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (options?.salonId) {
      where.salonId = options.salonId;
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [
      totalReviews,
      averageRating,
      reviewsByRating,
      reportedReviews,
      reviewsWithResponse,
      reviewsWithoutResponse,
      recentReviews,
      topRatedSalons,
      lowRatedSalons,
      reviewsByMonth,
    ] = await Promise.all([
      // إجمالي التقييمات
      this.prisma.review.count({ where }),

      // متوسط التقييم
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),

      // التقييمات حسب النجوم
      this.prisma.review.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),

      // التقييمات المبلغ عنها
      this.prisma.review.count({
        where: { ...where, isReported: true },
      }),

      // التقييمات مع رد
      this.prisma.review.count({
        where: { ...where, response: { not: null } },
      }),

      // التقييمات بدون رد
      this.prisma.review.count({
        where: { ...where, response: null },
      }),

      // آخر التقييمات
      this.prisma.review.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
          salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      // أفضل الصالونات تقييماً
      this.getTopRatedSalons(where, 10),

      // أسوأ الصالونات تقييماً
      this.getLowRatedSalons(where, 10),

      // التقييمات حسب الشهر
      this.getReviewsByMonth(where),
    ]);

    return {
      overview: {
        totalReviews,
        averageRating: averageRating._avg.rating || 0,
        reportedReviews,
        reviewsWithResponse,
        reviewsWithoutResponse,
        responseRate:
          totalReviews > 0
            ? ((reviewsWithResponse / totalReviews) * 100).toFixed(2)
            : '0.00',
      },
      byRating: reviewsByRating.map((item) => ({
        rating: item.rating,
        count: item._count.rating,
        percentage:
          totalReviews > 0
            ? ((item._count.rating / totalReviews) * 100).toFixed(2)
            : '0.00',
      })),
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isReported: review.isReported,
        hasResponse: !!review.response,
        createdAt: review.createdAt,
        customer: {
          id: review.customer.id,
          name: review.customer.fullName,
          image: review.customer.profileImage,
        },
        salon: {
          id: review.salon.id,
          name: review.salon.name,
        },
      })),
      topRatedSalons,
      lowRatedSalons,
      monthlyTrend: reviewsByMonth,
    };
  }

  /**
   * الحصول على أفضل الصالونات تقييماً
   */
  private async getTopRatedSalons(where: any, limit: number) {
    const salonRatings = await this.prisma.review.groupBy({
      by: ['salonId'],
      where,
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
        salonLogo: salon?.logo,
        averageRating: sr._avg.rating || 0,
        reviewCount: sr._count.rating,
      };
    });
  }

  /**
   * الحصول على أسوأ الصالونات تقييماً
   */
  private async getLowRatedSalons(where: any, limit: number) {
    const salonRatings = await this.prisma.review.groupBy({
      by: ['salonId'],
      where,
      _avg: { rating: true },
      _count: { rating: true },
      orderBy: { _avg: { rating: 'asc' } },
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
        salonLogo: salon?.logo,
        averageRating: sr._avg.rating || 0,
        reviewCount: sr._count.rating,
      };
    });
  }

  /**
   * الحصول على التقييمات حسب الشهر
   */
  private async getReviewsByMonth(where: any) {
    const months: { month: string; count: number; averageRating: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthWhere = {
        ...where,
        createdAt: {
          gte: date,
          lt: nextMonth,
        },
      };

      const [count, avg] = await Promise.all([
        this.prisma.review.count({ where: monthWhere }),
        this.prisma.review.aggregate({
          where: monthWhere,
          _avg: { rating: true },
        }),
      ]);

      months.push({
        month: date.toISOString().substring(0, 7), // YYYY-MM
        count,
        averageRating: avg._avg.rating || 0,
      });
    }

    return months;
  }

  /**
   * الحصول على التقييمات المشبوهة (تحتاج مراجعة)
   */
  async getSuspiciousReviews(options?: {
    minReports?: number;
    minNegativeRating?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      OR: [
        { isReported: true },
        { rating: { lte: options?.minNegativeRating || 2 } },
      ],
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    return this.prisma.review.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isReported: 'desc' },
        { rating: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * الحصول على تقييمات تحتاج رد من الصالون
   */
  async getReviewsNeedingResponse(options?: {
    salonId?: number;
    daysOld?: number;
  }) {
    const where: any = {
      response: null,
    };

    if (options?.salonId) {
      where.salonId = options.salonId;
    }

    if (options?.daysOld) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.daysOld);
      where.createdAt = {
        gte: cutoffDate,
      };
    }

    return this.prisma.review.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * تحليل جودة التقييمات
   */
  async analyzeReviewQuality(reviewId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        customer: true,
        salon: true,
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    // تحليل جودة التقييم
    const qualityScore = this.calculateQualityScore(review);

    // تحليل احتمالية أن يكون التقييم مزيف
    const fakeScore = this.calculateFakeScore(review);

    return {
      reviewId,
      qualityScore,
      fakeScore,
      recommendations: this.generateRecommendations(qualityScore, fakeScore),
    };
  }

  /**
   * حساب جودة التقييم
   */
  private calculateQualityScore(review: any): number {
    let score = 0;

    // طول التعليق
    if (review.comment && review.comment.length > 20) {
      score += 20;
    } else if (review.comment && review.comment.length > 10) {
      score += 10;
    }

    // وجود رد من الصالون
    if (review.response) {
      score += 20;
    }

    // التقييم ليس متطرف (1 أو 5 فقط)
    if (review.rating > 1 && review.rating < 5) {
      score += 20;
    }

    // التقييم ليس مبلغ عنه
    if (!review.isReported) {
      score += 20;
    }

    // عمر التقييم (أقدم = أفضل)
    const daysOld = Math.floor(
      (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysOld > 30) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * حساب احتمالية أن يكون التقييم مزيف
   */
  private calculateFakeScore(review: any): number {
    let score = 0;

    // تقييمات متطرفة (1 أو 5 فقط)
    if (review.rating === 1 || review.rating === 5) {
      score += 30;
    }

    // تقييمات بدون تعليق
    if (!review.comment || review.comment.length < 10) {
      score += 20;
    }

    // تقييمات مبلغ عنها
    if (review.isReported) {
      score += 30;
    }

    // تقييمات جديدة جداً
    const daysOld = Math.floor(
      (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysOld < 1) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * توليد توصيات
   */
  private generateRecommendations(
    qualityScore: number,
    fakeScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 50) {
      recommendations.push('التقييم يحتاج إلى تحسين الجودة');
    }

    if (fakeScore > 50) {
      recommendations.push('التقييم يحتاج إلى مراجعة - احتمالية أن يكون مزيف');
    }

    if (fakeScore > 70) {
      recommendations.push('التقييم مشبوه بشدة - يوصى بالحذف');
    }

    return recommendations;
  }
}

