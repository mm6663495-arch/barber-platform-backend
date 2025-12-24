import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetVisitsDto } from './dto/get-visits.dto';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DataSyncService } from '../websocket/services/data-sync.service';

@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DataSyncService))
    private dataSyncService?: DataSyncService,
  ) {}

  /**
   * الحصول على زيارات المستخدم
   */
  async getUserVisits(userId: number, query: GetVisitsDto) {
    const { page = 1, limit = 10, status, date, salonId } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      subscription: {
        customer: {
          userId: userId,
        },
      },
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (salonId) {
      where.salonId = salonId;
    }

    const [visits, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          visitDate: 'desc',
        },
        include: {
          subscription: {
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
                select: {
                  id: true,
                  name: true,
                  description: true,
                  images: true,
                },
              },
            },
          },
          salon: {
            select: {
              id: true,
              name: true,
              address: true,
              logo: true,
              images: true,
            },
          },
          review: {
            select: {
              id: true,
              rating: true,
              comment: true,
            },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    return {
      data: visits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * الحصول على زيارة محددة
   */
  async getVisitById(visitId: number, userId: number) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        subscription: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                profileImage: true,
                userId: true,
              },
            },
            package: {
              select: {
                id: true,
                name: true,
                description: true,
                images: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
            logo: true,
            images: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            response: true,
            createdAt: true,
          },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    // Check if user owns this visit
    const visitWithSubscription = visit as typeof visit & {
      subscription: {
        customer: { userId: number };
      };
    };

    if (
      !visitWithSubscription.subscription ||
      visitWithSubscription.subscription.customer.userId !== userId
    ) {
      throw new ForbiddenException('You can only view your own visits');
    }

    return visit;
  }

  /**
   * تحديث حالة الزيارة
   * ⭐ عند COMPLETED: خصم زيارة من الباقة
   * ⭐ عند CANCELLED: إرجاع زيارة للباقة (إذا كانت مخصومة)
   */
  async updateVisitStatus(
    visitId: number,
    userId: number,
    updateDto: UpdateVisitStatusDto,
  ) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        subscription: {
          select: {
            id: true,
            status: true,
            visitsUsed: true,
            visitsRemaining: true,
            customer: {
              select: {
                userId: true,
              },
            },
            package: {
              select: {
                visitsCount: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    // ⭐ التحقق من أن المستخدم هو صاحب الزيارة (Customer) أو صاحب الصالون (Salon Owner)
    const visitWithSubscription = visit as typeof visit & {
      subscription: {
        id: number;
        status: string;
        visitsUsed: number;
        visitsRemaining: number;
        customer: { userId: number };
        package?: { visitsCount: number };
      };
      salon: {
        owner?: { userId: number };
      };
    };

    const isCustomer = visitWithSubscription.subscription?.customer?.userId === userId;
    const isSalonOwner = visitWithSubscription.salon?.owner?.userId === userId;

    if (!isCustomer && !isSalonOwner) {
      throw new ForbiddenException('You can only update your own visits or visits in your salon');
    }

    const subscription = visitWithSubscription.subscription;
    const currentStatus = visit.status;
    const newStatus = updateDto.status;

    // ⭐ معالجة خصم/إرجاع الزيارة حسب الحالة
    // ⚠️ القاعدة: الزيارة تُخصم فقط عند إكمالها (COMPLETED)
    // ⚠️ عند الإلغاء من أي حالة: لا يتم خصم زيارة (أو إرجاعها إذا كانت مكتملة)
    
    if (newStatus === 'COMPLETED' && currentStatus !== 'COMPLETED') {
      // ⭐ التحقق الصارم من عدد الزيارات قبل السماح بإكمال الزيارة
      const packageVisitsCount = visitWithSubscription.subscription?.package?.visitsCount || 0;
      
      if (packageVisitsCount <= 0) {
        throw new BadRequestException('الباقة لا تحتوي على زيارات صالحة');
      }

      // ⭐ التحقق من عدد الزيارات المكتملة (COMPLETED) - هذه هي الزيارات التي تم خصمها فعلياً
      // نستثني الزيارة الحالية لأنها لم تكتمل بعد
      const completedVisitsCount = await this.prisma.visit.count({
        where: {
          subscriptionId: subscription.id,
          status: 'COMPLETED',
          id: { not: visitId }, // استثناء الزيارة الحالية
        },
      });

      // ⭐ التحقق الصارم: عدد الزيارات المكتملة + 1 يجب أن يكون <= عدد الزيارات في الباقة
      if (completedVisitsCount + 1 > packageVisitsCount) {
        throw new BadRequestException(
          `لا يمكن إكمال هذه الزيارة. عدد الزيارات المكتملة (${completedVisitsCount}) + 1 ` +
          `سيتجاوز عدد الزيارات في الباقة (${packageVisitsCount})`,
        );
      }

      // ⭐ التحقق من أن هناك زيارات متبقية قبل الخصم
      if (subscription.visitsRemaining <= 0) {
        throw new BadRequestException('لا توجد زيارات متبقية في هذه الباقة');
      }

      // ⭐ التحقق من التناسق: visitsRemaining + visitsUsed يجب أن يساوي package.visitsCount
      if (packageVisitsCount > 0) {
        const totalVisits = subscription.visitsRemaining + subscription.visitsUsed;
        if (totalVisits !== packageVisitsCount) {
          this.logger.warn(
            `[updateVisitStatus] ⚠️ Subscription ${subscription.id} has inconsistent visit counts: ` +
            `visitsRemaining=${subscription.visitsRemaining}, visitsUsed=${subscription.visitsUsed}, ` +
            `packageVisitsCount=${packageVisitsCount}, total=${totalVisits}, completedVisits=${completedVisitsCount}`,
          );
          // ⭐ تصحيح البيانات بناءً على عدد الزيارات المكتملة الفعلي
          const correctedVisitsUsed = completedVisitsCount;
          const correctedVisitsRemaining = Math.max(0, packageVisitsCount - correctedVisitsUsed);
          // ⭐ تحديث subscription قبل الخصم
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              visitsRemaining: correctedVisitsRemaining,
              visitsUsed: correctedVisitsUsed,
              status: correctedVisitsRemaining === 0 ? 'EXPIRED' : subscription.status,
            },
          });
          // ⭐ تحديث subscription object
          subscription.visitsRemaining = correctedVisitsRemaining;
          subscription.visitsUsed = correctedVisitsUsed;
          subscription.status = correctedVisitsRemaining === 0 ? 'EXPIRED' : subscription.status;
          
          // ⭐ إذا تم تصحيح البيانات وأصبحت الباقة منتهية، نرفض الطلب
          if (correctedVisitsRemaining <= 0) {
            throw new BadRequestException('لا توجد زيارات متبقية في هذه الباقة');
          }
        }
      }

      // ⭐ خصم زيارة من الباقة عند إكمال الزيارة فقط
      // ⚠️ هذا هو المكان الوحيد الذي يتم فيه خصم زيارة
      const updatedSubscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          visitsUsed: subscription.visitsUsed + 1,
          visitsRemaining: subscription.visitsRemaining - 1,
        },
        include: {
          customer: {
            select: {
              userId: true,
            },
          },
          package: {
            select: {
              salon: {
                select: {
                  ownerId: true,
                },
              },
            },
          },
        },
      });

      // ⭐ التحقق من انتهاء الباقة
      let finalSubscription = updatedSubscription;
      if (updatedSubscription.visitsRemaining === 0) {
        finalSubscription = await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
          include: {
            customer: {
              select: {
                userId: true,
              },
            },
            package: {
              select: {
                salon: {
                  select: {
                    ownerId: true,
                  },
                },
              },
            },
          },
        });
      }

      // ⭐ إرسال حدث مزامنة للزبون وصاحب الصالون
      if (this.dataSyncService) {
        const customerUserId = finalSubscription.customer?.userId;
        const salonOwnerId = finalSubscription.package?.salon?.ownerId;
        const affectedUserIds: number[] = [];
        
        if (customerUserId) {
          affectedUserIds.push(customerUserId);
        }
        if (salonOwnerId) {
          // الحصول على userId من ownerId
          const salonOwner = await this.prisma.salonOwner.findUnique({
            where: { id: salonOwnerId },
            select: { userId: true },
          });
          if (salonOwner?.userId) {
            affectedUserIds.push(salonOwner.userId);
          }
        }

        await this.dataSyncService.syncSubscription(
          subscription.id,
          'update',
          {
            status: finalSubscription.status,
            visitsUsed: finalSubscription.visitsUsed,
            visitsRemaining: finalSubscription.visitsRemaining,
            packageId: finalSubscription.packageId,
            customerId: finalSubscription.customerId,
          },
          affectedUserIds,
        );
      }
    } else if (newStatus === 'CANCELLED') {
      // ⭐ معالجة الإلغاء
      if (currentStatus === 'COMPLETED') {
        // ⭐ إرجاع زيارة للباقة عند إلغاء زيارة مكتملة
        const updatedSubscription = await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            visitsUsed: Math.max(0, subscription.visitsUsed - 1),
            visitsRemaining: subscription.visitsRemaining + 1,
            // ⭐ إعادة تفعيل الباقة إذا كانت منتهية
            status: subscription.status === 'EXPIRED' ? 'ACTIVE' : subscription.status,
          },
          include: {
            customer: {
              select: {
                userId: true,
              },
            },
            package: {
              select: {
                salon: {
                  select: {
                    ownerId: true,
                  },
                },
              },
            },
          },
        });

        // ⭐ إرسال حدث مزامنة للزبون وصاحب الصالون
        if (this.dataSyncService) {
          const customerUserId = updatedSubscription.customer?.userId;
          const salonOwnerId = updatedSubscription.package?.salon?.ownerId;
          const affectedUserIds: number[] = [];
          
          if (customerUserId) {
            affectedUserIds.push(customerUserId);
          }
          if (salonOwnerId) {
            // الحصول على userId من ownerId
            const salonOwner = await this.prisma.salonOwner.findUnique({
              where: { id: salonOwnerId },
              select: { userId: true },
            });
            if (salonOwner?.userId) {
              affectedUserIds.push(salonOwner.userId);
            }
          }

          await this.dataSyncService.syncSubscription(
            subscription.id,
            'update',
            {
              status: updatedSubscription.status,
              visitsUsed: updatedSubscription.visitsUsed,
              visitsRemaining: updatedSubscription.visitsRemaining,
              packageId: updatedSubscription.packageId,
              customerId: updatedSubscription.customerId,
            },
            affectedUserIds,
          );
        }
      }
      // ⚠️ إذا كانت الزيارة PENDING أو CONFIRMED وأصبحت CANCELLED:
      // لا نفعل شيء - لأن الزيارة لم تُخصم أصلاً
    }
    // ⚠️ أي حالة أخرى (PENDING → CONFIRMED, CONFIRMED → PENDING, etc.):
    // لا يتم خصم زيارة

    const updatedVisit = await this.prisma.visit.update({
      where: { id: visitId },
      data: {
        status: updateDto.status,
      },
      include: {
        subscription: {
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
              select: {
                id: true,
                name: true,
                description: true,
                images: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
            logo: true,
            images: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
      },
    });

    // Send notification if status changed to COMPLETED
    if (updateDto.status === 'COMPLETED') {
      await this.notificationsService.sendVisitNotification(
        visit.id,
        'completed',
      );
    }

    return updatedVisit;
  }

  /**
   * الحصول على إحصائيات الزيارات للمستخدم
   * ⭐ استبعاد الزيارات الملغية من الإحصائيات
   */
  async getVisitStats(userId: number) {
    const where = {
      subscription: {
        customer: {
          userId: userId,
        },
      },
      // ⭐ استبعاد الزيارات الملغية من الإحصائيات
      status: { not: 'CANCELLED' },
    };

    const [total, pending, confirmed, completed, cancelled] = await Promise.all([
      this.prisma.visit.count({ where }),
      this.prisma.visit.count({
        where: { ...where, status: 'PENDING' },
      }),
      this.prisma.visit.count({
        where: { ...where, status: 'CONFIRMED' },
      }),
      this.prisma.visit.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      // ⭐ عدد الزيارات الملغية (منفصلة)
      this.prisma.visit.count({
        where: {
          subscription: {
            customer: {
              userId: userId,
            },
          },
          status: 'CANCELLED',
        },
      }),
    ]);

    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
    };
  }
}

