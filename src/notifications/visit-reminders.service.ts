import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class VisitRemindersService {
  private readonly logger = new Logger(VisitRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * تذكير المواعيد قبل 24 ساعة
   * يعمل كل ساعة
   */
  @Cron(CronExpression.EVERY_HOUR)
  async send24HourReminders() {
    this.logger.log('Checking for visits 24 hours from now...');

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(now.getHours() + 24);

    // نطاق زمني: من الآن + 23 ساعة إلى الآن + 25 ساعة
    const startTime = new Date(tomorrow);
    startTime.setHours(tomorrow.getHours() - 1);
    const endTime = new Date(tomorrow);
    endTime.setHours(tomorrow.getHours() + 1);

    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'CONFIRMED',
        visitDate: {
          gte: startTime,
          lte: endTime,
        },
        // التحقق من عدم إرسال تذكير سابق
        // يمكنك إضافة حقل reminderSent في Visit model
      },
      include: {
        subscription: {
          include: {
            customer: {
              include: {
                user: {
                  select: {
                    id: true,
                    notificationSettings: true,
                  },
                },
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
        },
      },
    });

    for (const visit of visits) {
      const settings = visit.subscription.customer.user
        .notificationSettings as any;

      // التحقق من إعدادات المستخدم
      if (
        settings?.appointmentReminders === false ||
        settings?.appointmentReminders === undefined
      ) {
        continue; // المستخدم لا يريد تذكيرات المواعيد
      }

      const salonName = visit.subscription.package.salon.name;
      const visitDate = new Date(visit.visitDate);
      const formattedDate = visitDate.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.notificationsService.create({
        userId: visit.subscription.customer.userId,
        title: 'تذكير موعد',
        message: `لديك موعد في صالون ${salonName} غداً في ${formattedDate}`,
        type: 'VISIT',
        data: {
          visitId: visit.id,
          salonName: salonName,
          visitDate: visit.visitDate,
          reminderType: '24_hours',
        },
      });

      this.logger.log(
        `✅ 24-hour reminder sent for visit ${visit.id} to user ${visit.subscription.customer.userId}`,
      );
    }

    this.logger.log(`Sent ${visits.length} 24-hour reminders`);
  }

  /**
   * تذكير المواعيد قبل ساعتين
   * يعمل كل 30 دقيقة
   */
  @Cron('*/30 * * * *') // كل 30 دقيقة
  async send2HourReminders() {
    this.logger.log('Checking for visits 2 hours from now...');

    const now = new Date();
    const in2Hours = new Date(now);
    in2Hours.setHours(now.getHours() + 2);

    // نطاق زمني: من الآن + 1.5 ساعة إلى الآن + 2.5 ساعة
    const startTime = new Date(in2Hours);
    startTime.setMinutes(in2Hours.getMinutes() - 30);
    const endTime = new Date(in2Hours);
    endTime.setMinutes(in2Hours.getMinutes() + 30);

    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'CONFIRMED',
        visitDate: {
          gte: startTime,
          lte: endTime,
        },
      },
      include: {
        subscription: {
          include: {
            customer: {
              include: {
                user: {
                  select: {
                    id: true,
                    notificationSettings: true,
                  },
                },
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
        },
      },
    });

    for (const visit of visits) {
      const settings = visit.subscription.customer.user
        .notificationSettings as any;

      if (
        settings?.appointmentReminders === false ||
        settings?.appointmentReminders === undefined
      ) {
        continue;
      }

      const salonName = visit.subscription.package.salon.name;
      const visitDate = new Date(visit.visitDate);
      const formattedTime = visitDate.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.notificationsService.create({
        userId: visit.subscription.customer.userId,
        title: 'تذكير موعد قريب',
        message: `لديك موعد في صالون ${salonName} بعد ساعتين في الساعة ${formattedTime}`,
        type: 'VISIT',
        data: {
          visitId: visit.id,
          salonName: salonName,
          visitDate: visit.visitDate,
          reminderType: '2_hours',
        },
      });

      this.logger.log(
        `✅ 2-hour reminder sent for visit ${visit.id} to user ${visit.subscription.customer.userId}`,
      );
    }

    this.logger.log(`Sent ${visits.length} 2-hour reminders`);
  }

  /**
   * تذكير التقييم بعد 24 ساعة من إتمام الزيارة
   * يعمل كل ساعة
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendReviewReminders() {
    this.logger.log('Checking for completed visits needing review reminders...');

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setHours(now.getHours() - 24);

    // نطاق زمني: من الآن - 25 ساعة إلى الآن - 23 ساعة
    const startTime = new Date(yesterday);
    startTime.setHours(yesterday.getHours() - 1);
    const endTime = new Date(yesterday);
    endTime.setHours(yesterday.getHours() + 1);

    const visits = await this.prisma.visit.findMany({
      where: {
        status: 'COMPLETED',
        visitDate: {
          gte: startTime,
          lte: endTime,
        },
        // التحقق من عدم وجود تقييم
        review: null,
      },
      include: {
        subscription: {
          include: {
            customer: {
              include: {
                user: {
                  select: {
                    id: true,
                    notificationSettings: true,
                  },
                },
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
        review: true,
      },
    });

    for (const visit of visits) {
      const settings = visit.subscription.customer.user
        .notificationSettings as any;

      if (
        settings?.reviewNotifications === false ||
        settings?.reviewNotifications === undefined
      ) {
        continue;
      }

      const salonName = visit.subscription.package.salon.name;

      await this.notificationsService.sendVisitNotification(
        visit.id,
        'review_reminder',
      );

      this.logger.log(
        `✅ Review reminder sent for visit ${visit.id} to user ${visit.subscription.customer.userId}`,
      );
    }

    this.logger.log(`Sent ${visits.length} review reminders`);
  }
}

