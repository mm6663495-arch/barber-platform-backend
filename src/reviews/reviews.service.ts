import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DataSyncService } from '../websocket/services/data-sync.service';
import { ReviewsMonitoringService } from './services/reviews-monitoring.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { RespondToReviewDto } from './dto/respond-to-review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DataSyncService))
    private dataSyncService?: DataSyncService,
    @Inject(forwardRef(() => ReviewsMonitoringService))
    private monitoringService?: ReviewsMonitoringService,
  ) {}

  async create(createReviewDto: CreateReviewDto, customerId: number) {
    const { visitId, packageId, salonId, rating, comment } = createReviewDto;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    let finalSalonId: number;
    let finalPackageId: number | undefined = packageId;
    let finalVisitId: number | undefined = visitId;

    // Handle visit-based review (existing logic)
    if (visitId) {
      const visit = await this.prisma.visit.findUnique({
        where: { id: visitId },
        include: {
          subscription: {
            include: {
              customer: true,
              package: {
                include: {
                  salon: true,
                },
              },
            },
          },
        },
      });

      if (!visit) {
        throw new NotFoundException('Visit not found');
      }

      if (visit.subscription.customerId !== customerId) {
        throw new ForbiddenException('You can only review your own visits');
      }

      // Check if review already exists for this visit
      const existingReview = await this.prisma.review.findUnique({
        where: { visitId },
      });

      if (existingReview) {
        throw new BadRequestException('Review already exists for this visit');
      }

      // Check if visit is recent enough (within 30 minutes)
      const visitTime = new Date(visit.createdAt);
      const now = new Date();
      const timeDiff = now.getTime() - visitTime.getTime();
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

      if (timeDiff > thirtyMinutes) {
        throw new BadRequestException('Review period has expired (30 minutes after visit)');
      }

      finalSalonId = visit.subscription.package.salonId;
      finalPackageId = visit.subscription.packageId;
    } 
    // Handle package-based review
    else if (packageId) {
      const package_ = await this.prisma.package.findUnique({
        where: { id: packageId },
        include: {
          salon: true,
        },
      });

      if (!package_) {
        throw new NotFoundException('Package not found');
      }

      // Verify customer has subscription for this package (any status)
      // This allows customers to review packages they have ever subscribed to
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          packageId,
          customerId,
          // No status filter - allow review if customer ever subscribed (any status)
        },
        orderBy: {
          createdAt: 'desc', // Get the most recent subscription
        },
      });

      if (!subscription) {
        throw new ForbiddenException('You can only review packages you have subscribed to');
      }

      // Check if review already exists for this package by this customer
      const existingReview = await this.prisma.review.findFirst({
        where: {
          packageId,
          customerId,
          visitId: null,
        },
      });

      if (existingReview) {
        throw new BadRequestException('Review already exists for this package');
      }

      finalSalonId = package_.salonId;
    }
    // Handle salon-based review
    else if (salonId) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: salonId },
      });

      if (!salon) {
        throw new NotFoundException('Salon not found');
      }

      // Verify customer has subscription to packages from this salon (active or expired)
      // Check if customer exists first
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException('Customer profile not found');
      }

      // Find any subscription (ACTIVE, EXPIRED, CANCELLED, or SUSPENDED)
      // This allows customers to review salons they have ever subscribed to
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          customerId,
          package: {
            salonId,
          },
          // No status filter - allow review if customer ever subscribed (any status)
        },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              salonId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Get the most recent subscription
        },
      });

      if (!subscription) {
        // Provide more helpful error message
        throw new ForbiddenException(
          `You can only review salons you have subscribed to. ` +
          `Customer ID: ${customerId}, Salon ID: ${salonId}. ` +
          `Please subscribe to a package from this salon first.`
        );
      }

      // Check if review already exists for this salon by this customer (without package/visit)
      const existingReview = await this.prisma.review.findFirst({
        where: {
          salonId,
          customerId,
          visitId: null,
          packageId: null,
        },
      });

      if (existingReview) {
        throw new BadRequestException('Review already exists for this salon');
      }

      finalSalonId = salonId;
    } else {
      throw new BadRequestException('Either visitId, packageId, or salonId must be provided');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        customerId,
        salonId: finalSalonId,
        visitId: finalVisitId,
        packageId: finalPackageId,
        rating,
        comment,
        canEdit: true,
      },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        salon: {
          include: {
            owner: {
              include: {
                user: true,
              },
            },
          },
        },
        visit: {
          select: {
            id: true,
            visitDate: true,
            visitTime: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update salon rating
    await this.updateSalonRating(finalSalonId);

    // ⭐ إرسال إشعار للصالون عند تقييم جديد
    try {
      await this.notificationsService.sendReviewNotification(review.id, 'new_review');
    } catch (error) {
      this.logger.error(
        `Failed to send review notification to salon owner: ${error.message}`,
      );
    }

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      await this.dataSyncService.syncReview(
        review.id,
        'create',
        {
          rating: review.rating,
          salonId: review.salonId,
          packageId: review.packageId,
        },
      );
    }

    return review;
  }

  async findAll(salonId?: number, customerId?: number, packageId?: number, page = 1, limit = 10, rating?: number, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // ⭐ فلترة حسب rating
    if (rating !== undefined && rating !== null) {
      where.rating = rating;
    }

    // ⚠️ Note: Review model doesn't have a status field
    // Status filtering is handled on the frontend if needed
    // Reviews are considered "approved" by default (not reported)
    // You can filter by isReported if needed:
    // if (status === 'APPROVED') {
    //   where.isReported = false;
    // } else if (status === 'REPORTED') {
    //   where.isReported = true;
    // }

    // ⭐ بناء where clause بشكل أبسط وأكثر كفاءة
    if (salonId) {
      // البحث عن تقييمات الصالون مباشرة أو تقييمات الباقات التابعة للصالون
      // نستخدم OR للبحث في كلا الحالتين
      where.OR = [
        { salonId: salonId }, // تقييمات الصالون مباشرة (packageId قد يكون NULL)
        { 
          package: { 
            salonId: salonId 
          } 
        }, // تقييمات الباقات التابعة للصالون (packageId موجود)
      ];
      this.logger.log(`[findAll] Built OR query for salonId=${salonId}`);
    }

    if (customerId) {
      if (salonId) {
        // دمج مع salonId
        where.AND = [
          ...(where.OR ? [{ OR: where.OR }] : []),
          { customerId: customerId },
        ];
        delete where.OR;
      } else {
        where.customerId = customerId;
      }
    }

    if (packageId) {
      if (salonId || customerId) {
        if (!where.AND) {
          where.AND = [];
        }
        if (salonId && where.OR) {
          where.AND.push({ OR: where.OR });
          delete where.OR;
        }
        where.AND.push({ packageId: packageId });
      } else {
        where.packageId = packageId;
      }
    }

    this.logger.log(`[findAll] Query params: salonId=${salonId}, customerId=${customerId}, packageId=${packageId}, page=${page}, limit=${limit}, rating=${rating}, status=${status}`);
    this.logger.log(`[findAll] Where clause: ${JSON.stringify(where, null, 2)}`);

    try {
      const startTime = Date.now();
      const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
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
              logo: true,
            },
          },
          visit: {
            select: {
              id: true,
              visitDate: true,
              visitTime: true,
            },
          },
          package: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

      const duration = Date.now() - startTime;
      this.logger.log(`[findAll] Found ${reviews.length} reviews out of ${total} total (took ${duration}ms)`);
      if (reviews.length > 0) {
        this.logger.log(`[findAll] Sample review IDs: ${reviews.slice(0, 3).map(r => r.id).join(', ')}`);
        this.logger.log(`[findAll] First review: id=${reviews[0].id}, salonId=${reviews[0].salonId}, packageId=${reviews[0].packageId || 'NULL'}`);
      } else {
        this.logger.warn(`[findAll] No reviews found! Query: ${JSON.stringify(where)}`);
      }

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`[findAll] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
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
            logo: true,
            address: true,
          },
        },
        visit: {
          select: {
            id: true,
            visitDate: true,
            visitTime: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(id: number, updateReviewDto: UpdateReviewDto, customerId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.customerId !== customerId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    if (!review.canEdit) {
      throw new BadRequestException('Review can no longer be edited');
    }

    // Check if review is still within edit period (30 minutes)
    const reviewTime = new Date(review.createdAt);
    const now = new Date();
    const timeDiff = now.getTime() - reviewTime.getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    if (timeDiff > thirtyMinutes) {
      // Update canEdit flag
      await this.prisma.review.update({
        where: { id },
        data: { canEdit: false },
      });
      throw new BadRequestException('Review edit period has expired');
    }

    // Validate rating if provided
    if (updateReviewDto.rating && (updateReviewDto.rating < 1 || updateReviewDto.rating > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: {
        ...updateReviewDto,
        updatedAt: new Date(),
      },
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
        visit: {
          select: {
            id: true,
            visitDate: true,
            visitTime: true,
          },
        },
      },
    });

    // Update salon rating if rating was changed
    if (updateReviewDto.rating && updateReviewDto.rating !== review.rating) {
      await this.updateSalonRating(review.salonId);
    }

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      await this.dataSyncService.syncReview(
        updatedReview.id,
        'update',
        {
          rating: updatedReview.rating,
          salonId: updatedReview.salonId,
          packageId: updatedReview.packageId,
        },
      );
    }

    return updatedReview;
  }

  async respondToReview(id: number, respondToReviewDto: RespondToReviewDto, salonOwnerId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Verify salon ownership
    if (review.salon.ownerId !== salonOwnerId) {
      throw new ForbiddenException('You can only respond to reviews for your own salon');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id },
      data: {
        response: respondToReviewDto.response,
        updatedAt: new Date(),
      },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
        visit: {
          select: {
            id: true,
            visitDate: true,
            visitTime: true,
          },
        },
      },
    });

    // ⭐ إرسال إشعار للعميل عند الرد على تقييمه
    try {
      await this.notificationsService.sendReviewNotification(updatedReview.id, 'response');
    } catch (error) {
      this.logger.error(
        `Failed to send review response notification to customer: ${error.message}`,
      );
    }

    return updatedReview;
  }

  async remove(id: number, customerId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.customerId !== customerId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    if (!review.canEdit) {
      throw new BadRequestException('Review can no longer be deleted');
    }

    const deletedReview = await this.prisma.review.delete({
      where: { id },
    });

    // Update salon rating after deletion
    await this.updateSalonRating(review.salonId);

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      await this.dataSyncService.syncReview(
        deletedReview.id,
        'delete',
        {
          rating: deletedReview.rating,
          salonId: deletedReview.salonId,
          packageId: deletedReview.packageId,
        },
      );
    }

    return deletedReview;
  }

  // دالة خاصة بالـ Admin لحذف أي تقييم
  async removeByAdmin(id: number) {
    this.logger.log(`[removeByAdmin] Attempting to delete review #${id}`);
    
    // التحقق من وجود التقييم
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      this.logger.warn(`[removeByAdmin] Review #${id} not found in database`);
      
      // طباعة بعض IDs الموجودة للمساعدة في التشخيص
      const sampleReviews = await this.prisma.review.findMany({
        take: 10,
        select: { id: true },
        orderBy: { id: 'desc' },
      });
      const sampleIds = sampleReviews.map(r => r.id).join(', ');
      this.logger.log(`[removeByAdmin] Sample review IDs in database: ${sampleIds}`);
      
      throw new NotFoundException('Review not found');
    }
    
    this.logger.log(`[removeByAdmin] Review #${id} found, proceeding with deletion`);
    this.logger.log(`[removeByAdmin] Review details: salonId=${review.salonId}, customerId=${review.customerId}`);

    // حذف التقييم من قاعدة البيانات
    const deletedReview = await this.prisma.review.delete({
      where: { id },
    });

    this.logger.log(`[removeByAdmin] ✅ Review #${id} DELETED from database successfully`);
    this.logger.log(`[removeByAdmin] Deleted review ID: ${deletedReview.id}`);

    // Update salon rating after deletion
    this.logger.log(`[removeByAdmin] Updating salon rating for salon #${review.salonId}`);
    await this.updateSalonRating(review.salonId);
    this.logger.log(`[removeByAdmin] ✅ Salon rating updated successfully`);

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      await this.dataSyncService.syncReview(
        deletedReview.id,
        'delete',
        {
          rating: deletedReview.rating,
          salonId: deletedReview.salonId,
          packageId: deletedReview.packageId,
        },
      );
    }

    this.logger.log(`[removeByAdmin] ✅ Admin deleted review #${id} - Operation completed`);
    return deletedReview;
  }

  async reportReview(id: number, reporterId: number, reason: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Create report
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: review.customerId,
        type: 'INAPPROPRIATE_CONTENT',
        description: `Report for review #${id}: ${reason}`,
      },
    });

    // Mark review as reported
    await this.prisma.review.update({
      where: { id },
      data: { isReported: true },
    });

    return report;
  }

  async getSalonReviews(salonId: number, page = 1, limit = 10) {
    this.logger.log(`[getSalonReviews] Called with salonId=${salonId}, page=${page}, limit=${limit}`);
    const result = await this.findAll(salonId, undefined, undefined, page, limit);
    this.logger.log(`[getSalonReviews] Returning ${result.reviews.length} reviews`);
    return result;
  }

  async getCustomerReviews(customerId: number, page = 1, limit = 10) {
    return this.findAll(undefined, customerId, page, limit);
  }

  async getRecentReviews(limit = 10) {
    return this.prisma.review.findMany({
      take: limit,
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
            logo: true,
          },
        },
      },
    });
  }

  async getReviewStatistics(salonId?: number, customerId?: number) {
    const where: any = {};

    if (salonId) {
      // ⭐ البحث عن تقييمات الصالون مباشرة أو تقييمات الباقات التابعة للصالون
      where.OR = [
        { salonId: salonId }, // تقييمات الصالون مباشرة
        { package: { salonId: salonId } }, // تقييمات الباقات التابعة للصالون
      ];
    }

    if (customerId) {
      // إذا كان هناك salonId، نحتاج دمج الشرط
      if (salonId) {
        where.AND = [
          { OR: where.OR },
          { customerId: customerId },
        ];
        delete where.OR;
      } else {
        where.customerId = customerId;
      }
    }

    const [
      totalReviews,
      averageRating,
      ratingDistribution,
      reportedReviews,
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
        orderBy: { rating: 'asc' },
      }),
      this.prisma.review.count({ where: { ...where, isReported: true } }),
    ]);

    return {
      totalReviews,
      averageRating: averageRating._avg.rating || 0,
      ratingDistribution: ratingDistribution.map(item => ({
        rating: item.rating,
        count: item._count.rating,
      })),
      reportedReviews,
    };
  }

  private async updateSalonRating(salonId: number) {
    const reviews = await this.prisma.review.findMany({
      where: {
        salonId,
        isReported: false,
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      await this.prisma.salon.update({
        where: { id: salonId },
        data: {
          rating: 0,
          totalReviews: 0,
        },
      });
      return;
    }

    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    await this.prisma.salon.update({
      where: { id: salonId },
      data: {
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        totalReviews: reviews.length,
      },
    });
  }

  async checkAndUpdateCanEditFlag() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const updatedReviews = await this.prisma.review.updateMany({
      where: {
        canEdit: true,
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
      data: {
        canEdit: false,
      },
    });

    return {
      updatedCount: updatedReviews.count,
    };
  }

  /**
   * الحصول على إحصائيات شاملة (delegate to monitoring service)
   */
  async getComprehensiveStatistics(options?: {
    salonId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    if (!this.monitoringService) {
      throw new BadRequestException('Monitoring service not available');
    }
    return this.monitoringService.getComprehensiveStatistics(options);
  }

  /**
   * الحصول على التقييمات المشبوهة
   */
  async getSuspiciousReviews(options?: {
    minReports?: number;
    minNegativeRating?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    if (!this.monitoringService) {
      throw new BadRequestException('Monitoring service not available');
    }
    return this.monitoringService.getSuspiciousReviews(options);
  }

  /**
   * الحصول على تقييمات تحتاج رد
   */
  async getReviewsNeedingResponse(options?: {
    salonId?: number;
    daysOld?: number;
  }) {
    if (!this.monitoringService) {
      throw new BadRequestException('Monitoring service not available');
    }
    return this.monitoringService.getReviewsNeedingResponse(options);
  }

  /**
   * تحليل جودة التقييم
   */
  async analyzeReviewQuality(reviewId: number) {
    if (!this.monitoringService) {
      throw new BadRequestException('Monitoring service not available');
    }
    return this.monitoringService.analyzeReviewQuality(reviewId);
  }
}
