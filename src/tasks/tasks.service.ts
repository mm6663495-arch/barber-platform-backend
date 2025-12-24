import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ReviewsService } from '../reviews/reviews.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SecurityService } from '../security/security.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
    private reviewsService: ReviewsService,
    private notificationsService: NotificationsService,
    private securityService: SecurityService,
  ) {}

  // Check for expired subscriptions every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredSubscriptions() {
    this.logger.log('Checking for expired subscriptions...');
    
    try {
      const result = await this.subscriptionsService.checkExpiredSubscriptions();
      this.logger.log(`Found ${result.expiredCount} expired subscriptions`);
      
      // Send notifications for expired subscriptions
      for (const subscriptionId of result.expiredSubscriptions) {
        await this.notificationsService.sendSubscriptionNotification(subscriptionId, 'expired');
      }
    } catch (error) {
      this.logger.error('Error checking expired subscriptions:', error);
    }
  }

  // Check for subscriptions expiring in 3 days
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleExpiringSubscriptions() {
    this.logger.log('Checking for expiring subscriptions...');
    
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const expiringSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            lte: threeDaysFromNow,
            gte: new Date(),
          },
        },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          package: {
            include: {
              salon: {
                include: {
                  owner: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      this.logger.log(`Found ${expiringSubscriptions.length} subscriptions expiring in 3 days`);

      // Send expiry warning notifications
      for (const subscription of expiringSubscriptions) {
        // ⭐ إشعار للعميل
        try {
          await this.notificationsService.sendSubscriptionNotification(
            subscription.id,
            'expired', // نستخدم expired كـ type للتحذير
          );
        } catch (error) {
          this.logger.error(
            `Failed to send expiry warning to customer for subscription ${subscription.id}: ${error.message}`,
          );
        }

        // ⭐ إشعار للصالون
        try {
          await this.notificationsService.sendSubscriptionNotificationForSalon(
            subscription.id,
            'expiring_soon',
          );
        } catch (error) {
          this.logger.error(
            `Failed to send expiry warning to salon owner for subscription ${subscription.id}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error checking expiring subscriptions:', error);
    }
  }

  // Update review edit flags every 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleReviewEditFlags() {
    this.logger.log('Updating review edit flags...');
    
    try {
      const result = await this.reviewsService.checkAndUpdateCanEditFlag();
      this.logger.log(`Updated ${result.updatedCount} review edit flags`);
    } catch (error) {
      this.logger.error('Error updating review edit flags:', error);
    }
  }

  // Send review reminder notifications
  @Cron(CronExpression.EVERY_HOUR)
  async handleReviewReminders() {
    this.logger.log('Sending review reminders...');
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Find visits from 1-2 hours ago that don't have reviews
      const visitsWithoutReviews = await this.prisma.visit.findMany({
        where: {
          createdAt: {
            gte: twoHoursAgo,
            lte: oneHourAgo,
          },
          review: null,
        },
        include: {
          subscription: {
            include: {
              customer: {
                include: {
                  user: true,
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
      });

      this.logger.log(`Found ${visitsWithoutReviews.length} visits needing review reminders`);

      // Send review reminder notifications
      for (const visit of visitsWithoutReviews) {
        await this.notificationsService.sendVisitNotification(visit.id, 'review_reminder');
      }
    } catch (error) {
      this.logger.error('Error sending review reminders:', error);
    }
  }

  // Cleanup old notifications daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNotificationCleanup() {
    this.logger.log('Cleaning up old notifications...');
    
    try {
      const result = await this.notificationsService.cleanupOldNotifications(30);
      this.logger.log(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
      this.logger.error('Error cleaning up notifications:', error);
    }
  }

  // Cleanup old security logs weekly
  @Cron(CronExpression.EVERY_WEEK)
  async handleSecurityLogCleanup() {
    this.logger.log('Cleaning up old security logs...');
    
    try {
      const result = await this.securityService.cleanupOldSecurityLogs(90);
      this.logger.log(`Cleaned up ${result.deletedCount} old security logs`);
    } catch (error) {
      this.logger.error('Error cleaning up security logs:', error);
    }
  }

  // Generate daily reports
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyReports() {
    this.logger.log('Generating daily reports...');
    
    try {
      // This could send daily reports to admins
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [
        newUsers,
        newSubscriptions,
        newPayments,
        totalRevenue,
      ] = await Promise.all([
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: yesterday,
            },
          },
        }),
        this.prisma.subscription.count({
          where: {
            createdAt: {
              gte: yesterday,
            },
          },
        }),
        this.prisma.payment.count({
          where: {
            createdAt: {
              gte: yesterday,
            },
            status: 'COMPLETED',
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            createdAt: {
              gte: yesterday,
            },
            status: 'COMPLETED',
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      this.logger.log(`Daily report: ${newUsers} new users, ${newSubscriptions} new subscriptions, ${newPayments} payments, $${totalRevenue._sum.amount || 0} revenue`);
    } catch (error) {
      this.logger.error('Error generating daily reports:', error);
    }
  }

  // Update salon ratings daily
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleSalonRatingUpdate() {
    this.logger.log('Updating salon ratings...');
    
    try {
      const salons = await this.prisma.salon.findMany({
        include: {
          reviews: {
            where: {
              isReported: false,
            },
          },
        },
      });

      for (const salon of salons) {
        if (salon.reviews.length === 0) {
          await this.prisma.salon.update({
            where: { id: salon.id },
            data: {
              rating: 0,
              totalReviews: 0,
            },
          });
        } else {
          const averageRating = salon.reviews.reduce((sum, review) => sum + review.rating, 0) / salon.reviews.length;
          
          await this.prisma.salon.update({
            where: { id: salon.id },
            data: {
              rating: Math.round(averageRating * 10) / 10,
              totalReviews: salon.reviews.length,
            },
          });
        }
      }

      this.logger.log(`Updated ratings for ${salons.length} salons`);
    } catch (error) {
      this.logger.error('Error updating salon ratings:', error);
    }
  }

  // Check for suspicious activities every 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleSuspiciousActivityCheck() {
    this.logger.log('Checking for suspicious activities...');
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Find users with multiple failed login attempts
      const failedLogins = await this.prisma.auditLog.findMany({
        where: {
          action: 'login_failed',
          createdAt: {
            gte: oneHourAgo,
          },
        },
        select: {
          userId: true,
          ipAddress: true,
        },
      });

      const userFailedCounts = new Map<number, number>();
      const ipFailedCounts = new Map<string, number>();

      failedLogins.forEach(login => {
        if (login.userId) {
          userFailedCounts.set(login.userId, (userFailedCounts.get(login.userId) || 0) + 1);
        }
        if (login.ipAddress) {
          ipFailedCounts.set(login.ipAddress, (ipFailedCounts.get(login.ipAddress) || 0) + 1);
        }
      });

      // Check for users with more than 5 failed attempts
      for (const [userId, count] of userFailedCounts) {
        if (count >= 5) {
          this.logger.warn(`Suspicious activity detected for user ${userId}: ${count} failed login attempts`);
          
          await this.securityService.logSecurityEvent(userId, 'suspicious_login_attempts', {
            failedAttempts: count,
            timeWindow: '1 hour',
          });
        }
      }

      // Check for IPs with more than 10 failed attempts
      for (const [ipAddress, count] of ipFailedCounts) {
        if (count >= 10) {
          this.logger.warn(`Suspicious activity detected from IP ${ipAddress}: ${count} failed login attempts`);
          
          await this.securityService.logSecurityEvent(0, 'suspicious_ip_activity', {
            ipAddress,
            failedAttempts: count,
            timeWindow: '1 hour',
          });
        }
      }
    } catch (error) {
      this.logger.error('Error checking suspicious activities:', error);
    }
  }
}
