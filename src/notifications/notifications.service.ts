import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { BroadcastNotificationDto, BroadcastTarget } from './dto/broadcast-notification.dto';
import { ScheduleNotificationDto } from './dto/schedule-notification.dto';
import { NotificationType, UserRole } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { SmsService } from './services/sms.service';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;
  private firebaseApp: admin.app.App;
  private websocketNotificationService: any; // WebSocket NotificationService

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private smsService: SmsService,
    @Optional()
    @Inject(forwardRef(() => {
      // Dynamic import to avoid circular dependency
      try {
        return require('../websocket/services/notification.service').NotificationService;
      } catch {
        return null;
      }
    }))
    websocketNotificationService?: any,
  ) {
    // Initialize email transporter
    this.initializeEmailTransporter();

    // Initialize Firebase
    this.initializeFirebase();

    // Store WebSocket service reference
    this.websocketNotificationService = websocketNotificationService;
  }

  /**
   * تعيين WebSocket NotificationService (يتم استدعاؤه من WebSocketModule)
   */
  setWebSocketService(service: any) {
    this.websocketNotificationService = service;
  }

  private initializeEmailTransporter() {
    try {
      const smtpConfig = {
        host: this.configService.get<string>('email.host') || this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('email.port') || this.configService.get<number>('SMTP_PORT') || 587,
        secure: false,
        auth: {
          user: this.configService.get<string>('email.user') || this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('email.pass') || this.configService.get<string>('SMTP_PASS'),
        },
      };

      if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
        this.transporter = nodemailer.createTransport(smtpConfig);
        console.log('Email transporter initialized successfully');
      } else {
        console.log('Email configuration is incomplete, skipping email initialization');
      }
    } catch (error) {
      console.log('Failed to initialize email transporter:', error.message);
      console.log('Continuing without email support');
    }
  }

  private initializeFirebase() {
    try {
      const firebaseConfig = {
        projectId: this.configService.get<string>('firebase.projectId'),
        privateKey: this.configService.get<string>('firebase.privateKey')?.replace(/\\n/g, '\n'),
        clientEmail: this.configService.get<string>('firebase.clientEmail'),
      };

      // Check if all required Firebase config is available and valid
      if (firebaseConfig.projectId && firebaseConfig.privateKey && firebaseConfig.clientEmail) {
        // Validate private key format
        if (firebaseConfig.privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
            firebaseConfig.privateKey.includes('-----END PRIVATE KEY-----')) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
          });
          console.log('Firebase initialized successfully');
        } else {
          console.log('Firebase private key format is invalid, skipping Firebase initialization');
        }
      } else {
        console.log('Firebase configuration is incomplete, skipping Firebase initialization');
      }
    } catch (error) {
      console.log('Failed to initialize Firebase:', error.message);
      console.log('Continuing without Firebase support');
    }
  }

  async create(createNotificationDto: CreateNotificationDto) {
    const { userId, title, message, type, data } = createNotificationDto;

    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type as NotificationType,
        data: data || {},
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async createBulk(notifications: CreateNotificationDto[]) {
    const notificationData = notifications.map(notification => ({
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type as NotificationType,
      data: notification.data || {},
    }));

    return this.prisma.notification.createMany({
      data: notificationData,
    });
  }

  async findAll(userId: number, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAsRead(id: number, userId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async remove(id: number, userId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  // Specific notification types
  async sendSubscriptionNotification(subscriptionId: number, type: 'created' | 'expired' | 'renewed') {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
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
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    let title: string;
    let message: string;
    let notificationType: NotificationType;

    switch (type) {
      case 'created':
        title = 'اشتراك جديد';
        message = `تم إنشاء اشتراكك الجديد في صالون ${subscription.package.salon.name}`;
        notificationType = NotificationType.SUBSCRIPTION;
        break;
      case 'expired':
        title = 'انتهاء الاشتراك';
        message = `انتهى اشتراكك في صالون ${subscription.package.salon.name}`;
        notificationType = NotificationType.EXPIRY_WARNING;
        break;
      case 'renewed':
        title = 'تجديد الاشتراك';
        message = `تم تجديد اشتراكك في صالون ${subscription.package.salon.name}`;
        notificationType = NotificationType.SUBSCRIPTION;
        break;
    }

    const notification = await this.create({
      userId: subscription.customer.userId,
      title,
      message,
      type: notificationType,
      data: {
        subscriptionId,
        salonName: subscription.package.salon.name,
        packageName: subscription.package.name,
      },
    });

    // ⭐ إرسال إشعار عبر WebSocket
    if (this.websocketNotificationService) {
      try {
        await this.websocketNotificationService.sendNotification(
          subscription.customer.userId,
          {
            type: notificationType,
            message: `${title}: ${message}`,
            data: {
              subscriptionId,
              salonName: subscription.package.salon.name,
              packageName: subscription.package.name,
            },
          },
        );
      } catch (error) {
        console.error('Failed to send WebSocket notification:', error);
      }
    }

    // Send unified notifications (Push + Email + SMS)
    await this.sendUnifiedNotification(
      subscription.customer.userId,
      title,
      message,
      {
        push: true,
        email: true,
        sms: true,
        data: {
          subscriptionId,
          type: 'subscription',
          salonName: subscription.package.salon.name,
          packageName: subscription.package.name,
        },
      },
    );

    return notification;
  }

  // ⭐ إرسال إشعار للصالون عند إنشاء/إلغاء/قرب انتهاء اشتراك
  async sendSubscriptionNotificationForSalon(
    subscriptionId: number,
    type: 'created' | 'cancelled' | 'expiring_soon',
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
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

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    let title: string;
    let message: string;
    let notificationType: NotificationType;

    switch (type) {
      case 'created':
        title = 'اشتراك جديد';
        message = `اشتراك جديد من ${subscription.customer.fullName} في باقة ${subscription.package.name}`;
        notificationType = NotificationType.SUBSCRIPTION;
        break;
      case 'cancelled':
        title = 'إلغاء اشتراك';
        message = `تم إلغاء اشتراك ${subscription.customer.fullName} في باقة ${subscription.package.name}`;
        notificationType = NotificationType.SUBSCRIPTION;
        break;
      case 'expiring_soon':
        const daysRemaining = Math.ceil(
          (subscription.endDate.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        );
        title = 'اشتراك قريب من الانتهاء';
        message = `اشتراك ${subscription.customer.fullName} في باقة ${subscription.package.name} سينتهي خلال ${daysRemaining} يوم`;
        notificationType = NotificationType.EXPIRY_WARNING;
        break;
    }

    const notification = await this.create({
      userId: subscription.package.salon.owner.userId,
      title,
      message,
      type: notificationType,
      data: {
        subscriptionId,
        customerName: subscription.customer.fullName,
        packageName: subscription.package.name,
        salonId: subscription.package.salonId,
      },
    });

    // ⭐ إرسال إشعار عبر WebSocket للصالون
    if (this.websocketNotificationService) {
      try {
        await this.websocketNotificationService.sendNotification(
          subscription.package.salon.owner.userId,
          {
            type: notificationType,
            title: title,
            message: message,
            data: {
              subscriptionId,
              customerName: subscription.customer.fullName,
              packageName: subscription.package.name,
              salonId: subscription.package.salonId,
            },
          },
        );
      } catch (error) {
        console.error('Failed to send WebSocket notification to salon:', error);
      }
    }

    // Send unified notifications (Push + Email + SMS)
    await this.sendUnifiedNotification(
      subscription.package.salon.owner.userId,
      title,
      message,
      {
        push: true,
        email: true,
        sms: true,
        data: {
          subscriptionId,
          type: 'subscription',
        },
      },
    );

    return notification;
  }

  async sendVisitNotification(visitId: number, type: 'completed' | 'review_reminder') {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
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

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    let title: string;
    let message: string;
    let notificationType: NotificationType;

    switch (type) {
      case 'completed':
        title = 'زيارة مكتملة';
        message = `تم تسجيل زيارتك في صالون ${visit.subscription.package.salon.name}`;
        notificationType = NotificationType.VISIT;
        break;
      case 'review_reminder':
        title = 'تذكير التقييم';
        message = `لا تنس تقييم زيارتك في صالون ${visit.subscription.package.salon.name}`;
        notificationType = NotificationType.REVIEW;
        break;
    }

    const notification = await this.create({
      userId: visit.subscription.customer.userId,
      title,
      message,
      type: notificationType,
      data: {
        visitId,
        salonName: visit.subscription.package.salon.name,
        visitDate: visit.visitDate,
      },
    });

    // ⭐ إرسال إشعار عبر WebSocket
    if (this.websocketNotificationService) {
      try {
        await this.websocketNotificationService.sendNotification(
          visit.subscription.customer.userId,
          {
            type: notificationType,
            title: title,
            message: message,
            data: {
              visitId,
              salonName: visit.subscription.package.salon.name,
              visitDate: visit.visitDate,
            },
          },
        );
      } catch (error) {
        console.error('Failed to send WebSocket notification:', error);
      }
    }

    // Send unified notifications (Push + Email + SMS)
    await this.sendUnifiedNotification(
      visit.subscription.customer.userId,
      title,
      message,
      {
        push: true,
        email: true,
        sms: true,
        data: {
          visitId,
          type: 'visit',
        },
      },
    );

    return notification;
  }

  async sendReviewNotification(reviewId: number, type: 'new_review' | 'response') {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
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
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    let title: string;
    let message: string;
    let notificationType: NotificationType;
    let targetUserId: number;

    switch (type) {
      case 'new_review':
        title = 'تقييم جديد';
        message = `تلقيت تقييماً جديداً من ${review.customer.fullName}`;
        notificationType = NotificationType.REVIEW;
        targetUserId = review.salon.owner.userId;
        break;
      case 'response':
        title = 'رد على تقييمك';
        message = `رد صاحب صالون ${review.salon.name} على تقييمك`;
        notificationType = NotificationType.REVIEW;
        targetUserId = review.customer.userId;
        break;
    }

    const notification = await this.create({
      userId: targetUserId,
      title,
      message,
      type: notificationType,
      data: {
        reviewId,
        salonName: review.salon.name,
        customerName: review.customer.fullName,
        rating: review.rating,
      },
    });

    // ⭐ إرسال إشعار عبر WebSocket
    if (this.websocketNotificationService) {
      try {
        await this.websocketNotificationService.sendNotification(
          targetUserId,
          {
            type: notificationType,
            message: `${title}: ${message}`,
            data: {
              reviewId,
              salonName: review.salon.name,
              customerName: review.customer.fullName,
              rating: review.rating,
            },
          },
        );
      } catch (error) {
        console.error('Failed to send WebSocket notification:', error);
      }
    }

    // Send unified notifications (Push + Email + SMS)
    await this.sendUnifiedNotification(
      targetUserId,
      title,
      message,
      {
        push: true,
        email: true,
        sms: true,
        data: {
          reviewId,
          type: 'review',
        },
      },
    );

    return notification;
  }

  // ⭐ إرسال إشعار للصالون عند تسجيل زيارة
  async sendVisitNotificationForSalon(visitId: number) {
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
        },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const title = 'زيارة جديدة';
    const message = `زيارة جديدة من ${visit.subscription.customer.fullName} في باقة ${visit.subscription.package.name}`;
    const notificationType = NotificationType.VISIT;

    const notification = await this.create({
      userId: visit.subscription.package.salon.owner.userId,
      title,
      message,
      type: notificationType,
      data: {
        visitId,
        customerName: visit.subscription.customer.fullName,
        packageName: visit.subscription.package.name,
        salonId: visit.salonId,
        visitDate: visit.visitDate,
      },
    });

    // ⭐ إرسال إشعار عبر WebSocket للصالون
    if (this.websocketNotificationService) {
      try {
        await this.websocketNotificationService.sendNotification(
          visit.subscription.package.salon.owner.userId,
          {
            type: notificationType,
            title: title,
            message: message,
            data: {
              visitId,
              customerName: visit.subscription.customer.fullName,
              packageName: visit.subscription.package.name,
              salonId: visit.salonId,
              visitDate: visit.visitDate,
            },
          },
        );
      } catch (error) {
        console.error('Failed to send WebSocket notification to salon:', error);
      }
    }

    // Send unified notifications (Push + Email + SMS)
    await this.sendUnifiedNotification(
      visit.subscription.package.salon.owner.userId,
      title,
      message,
      {
        push: true,
        email: true,
        sms: true,
        data: {
          visitId,
          type: 'visit',
        },
      },
    );

    return notification;
  }

  async sendPaymentNotification(paymentId: number, type: 'success' | 'failed' | 'refund') {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
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

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    let title: string;
    let message: string;
    let notificationType: NotificationType;

    switch (type) {
      case 'success':
        title = 'دفع ناجح';
        message = `تم استلام دفعتك بنجاح لاشتراك في صالون ${payment.subscription.package.salon.name}`;
        notificationType = NotificationType.PAYMENT;
        break;
      case 'failed':
        title = 'فشل الدفع';
        message = `فشل في معالجة دفعتك لاشتراك في صالون ${payment.subscription.package.salon.name}`;
        notificationType = NotificationType.PAYMENT;
        break;
      case 'refund':
        title = 'استرداد الدفع';
        message = `تم استرداد دفعتك لاشتراك في صالون ${payment.subscription.package.salon.name}`;
        notificationType = NotificationType.PAYMENT;
        break;
    }

    const notification = await this.create({
      userId: payment.subscription.customer.userId,
      title,
      message,
      type: notificationType,
      data: {
        paymentId,
        amount: payment.amount,
        salonName: payment.subscription.package.salon.name,
        paymentMethod: payment.paymentMethod,
      },
    });

    // Send unified notifications (Push + Email + SMS)
    // Always send email and SMS for payment events (important)
    await this.sendUnifiedNotification(
      payment.subscription.customer.userId,
      title,
      message,
      {
        push: true,
        email: type === 'success' || type === 'failed', // Email for important events
        sms: type === 'success' || type === 'failed', // SMS for important events
        data: {
          paymentId,
          type: 'payment',
        },
      },
    );

    return notification;
  }

  async sendGeneralNotification(userIds: number[], title: string, message: string) {
    const notifications = userIds.map(userId => ({
      userId,
      title,
      message,
      type: NotificationType.GENERAL,
    }));

    const result = await this.createBulk(notifications);

    // Send unified notifications (Push + Email + SMS)
    for (const userId of userIds) {
      await this.sendUnifiedNotification(
        userId,
        title,
        message,
        {
          push: true,
          email: true,
          sms: false, // Don't send SMS for general notifications
          data: {
            type: 'general',
          },
        },
      );
    }

    return result;
  }

  private async sendPushNotification(userId: number, title: string, message: string, data?: any) {
    if (!this.firebaseApp) {
      console.log('Firebase not configured, skipping push notification');
      return;
    }

    try {
      // جلب FCM Token من notificationSettings
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          notificationSettings: true,
        },
      });

      if (!user || !user.notificationSettings) {
        console.log(`No FCM token found for user ${userId}`);
        return;
      }

      const settings = user.notificationSettings as any;
      const fcmToken = settings.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return;
      }

      // إرسال إشعار Push عبر Firebase
      const messaging = admin.messaging(this.firebaseApp);
      
      await messaging.send({
        token: fcmToken,
        notification: {
          title: title,
          body: message,
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      console.log(`✅ Push notification sent to user ${userId}: ${title}`);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  private async sendEmailNotification(email: string, title: string, message: string) {
    if (!this.transporter) {
      console.log('Email not configured, skipping email notification');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('email.user'),
        to: email,
        subject: title,
        html: `
          <h2>${title}</h2>
          <p>${message}</p>
          <hr>
          <p><small>هذه رسالة تلقائية من منصة صالونات الحلاقة</small></p>
        `,
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * إرسال إشعار SMS
   */
  private async sendSmsNotification(userId: number, message: string): Promise<boolean> {
    try {
      // جلب بيانات المستخدم ورقم الهاتف
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          customer: {
            select: { phone: true },
          },
          salonOwner: {
            select: { phone: true },
          },
          platformAdmin: {
            select: { fullName: true },
          },
        },
      });

      if (!user) {
        console.log(`User ${userId} not found for SMS notification`);
        return false;
      }

      // جلب رقم الهاتف من الملف الشخصي المناسب
      let phone: string | null = null;
      
      // Type assertion للوصول إلى العلاقات
      const userWithRelations = user as any;
      
      if (userWithRelations.customer?.phone) {
        phone = userWithRelations.customer.phone;
      } else if (userWithRelations.salonOwner?.phone) {
        phone = userWithRelations.salonOwner.phone;
      } else if (userWithRelations.platformAdmin) {
        // PlatformAdmin لا يحتوي على phone في الـ schema
        // يمكن إضافة phone إلى PlatformAdmin في المستقبل إذا لزم الأمر
        console.log(`PlatformAdmin ${userId} does not have phone number in schema`);
        return false;
      }

      if (!phone) {
        console.log(`No phone number found for user ${userId}`);
        return false;
      }

      // التحقق من إعدادات المستخدم
      const settings = user.notificationSettings as any;
      if (settings && settings.smsNotifications === false) {
        console.log(`SMS notifications disabled for user ${userId}`);
        return false;
      }

      // إرسال SMS
      return await this.smsService.sendSms(phone, message);
    } catch (error) {
      console.error(`Failed to send SMS notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * إرسال إشعار موحد (Push + Email + SMS)
   */
  async sendUnifiedNotification(
    userId: number,
    title: string,
    message: string,
    options?: {
      push?: boolean;
      email?: boolean;
      sms?: boolean;
      data?: any;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      console.log(`User ${userId} not found`);
      return;
    }

    const settings = (user.notificationSettings as any) || {};
    const pushEnabled = options?.push !== false && settings.pushNotifications !== false;
    const emailEnabled = options?.email !== false && settings.emailNotifications !== false;
    const smsEnabled = options?.sms !== false && settings.smsNotifications !== false;

    // إرسال Push Notification
    if (pushEnabled) {
      await this.sendPushNotification(userId, title, message, options?.data);
    }

    // إرسال Email Notification
    if (emailEnabled && user.email) {
      await this.sendEmailNotification(user.email, title, message);
    }

    // إرسال SMS Notification
    if (smsEnabled) {
      await this.sendSmsNotification(userId, `${title}: ${message}`);
    }
  }

  async getNotificationStatistics(userId?: number) {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const [
      totalNotifications,
      unreadNotifications,
      notificationsByType,
    ] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
    ]);

    return {
      totalNotifications,
      unreadNotifications,
      readNotifications: totalNotifications - unreadNotifications,
      notificationsByType: notificationsByType.map(item => ({
        type: item.type,
        count: item._count.type,
      })),
    };
  }

  async cleanupOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true,
      },
    });

    return {
      deletedCount: result.count,
    };
  }

  // Notification Settings methods
  async getNotificationSettings(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return default settings if none exist
    const defaultSettings = {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      newCustomerNotifications: true,
      appointmentReminders: true,
      paymentNotifications: true,
      reviewNotifications: true,
      promotionNotifications: false,
      systemUpdates: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    if (!user.notificationSettings || typeof user.notificationSettings !== 'object') {
      return defaultSettings;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...defaultSettings,
      ...(user.notificationSettings as any),
    };
  }

  async updateNotificationSettings(
    userId: number,
    updateSettingsDto: UpdateNotificationSettingsDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get current settings or use defaults
    const currentSettings = user.notificationSettings
      ? (user.notificationSettings as any)
      : {};

    // Merge with new settings
    const updatedSettings = {
      ...currentSettings,
      ...(updateSettingsDto.pushNotifications !== undefined && {
        pushNotifications: updateSettingsDto.pushNotifications,
      }),
      ...(updateSettingsDto.emailNotifications !== undefined && {
        emailNotifications: updateSettingsDto.emailNotifications,
      }),
      ...(updateSettingsDto.smsNotifications !== undefined && {
        smsNotifications: updateSettingsDto.smsNotifications,
      }),
      ...(updateSettingsDto.newCustomerNotifications !== undefined && {
        newCustomerNotifications: updateSettingsDto.newCustomerNotifications,
      }),
      ...(updateSettingsDto.appointmentReminders !== undefined && {
        appointmentReminders: updateSettingsDto.appointmentReminders,
      }),
      ...(updateSettingsDto.paymentNotifications !== undefined && {
        paymentNotifications: updateSettingsDto.paymentNotifications,
      }),
      ...(updateSettingsDto.reviewNotifications !== undefined && {
        reviewNotifications: updateSettingsDto.reviewNotifications,
      }),
      ...(updateSettingsDto.promotionNotifications !== undefined && {
        promotionNotifications: updateSettingsDto.promotionNotifications,
      }),
      ...(updateSettingsDto.systemUpdates !== undefined && {
        systemUpdates: updateSettingsDto.systemUpdates,
      }),
      ...(updateSettingsDto.quietHours && {
        quietHours: {
          ...(currentSettings.quietHours || {}),
          ...updateSettingsDto.quietHours,
        },
      }),
    };

    // Update user with new settings
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationSettings: updatedSettings,
      },
      select: {
        id: true,
        notificationSettings: true,
      },
    });

    return updatedUser.notificationSettings;
  }

  /**
   * Broadcast notification to multiple users based on target criteria
   */
  async broadcastNotification(broadcastDto: BroadcastNotificationDto) {
    const {
      title,
      message,
      type = NotificationType.GENERAL,
      target,
      userIds,
      role,
      salonIds,
      data,
      sendPush = true,
      sendEmail = false,
    } = broadcastDto;

    let targetUserIds: number[] = [];

    // Determine target users based on broadcast target
    switch (target) {
      case BroadcastTarget.ALL_USERS:
        const allUsers = await this.prisma.user.findMany({
          select: { id: true },
        });
        targetUserIds = allUsers.map((u) => u.id);
        break;

      case BroadcastTarget.ALL_CUSTOMERS:
        const customers = await this.prisma.user.findMany({
          where: { role: UserRole.CUSTOMER },
          select: { id: true },
        });
        targetUserIds = customers.map((u) => u.id);
        break;

      case BroadcastTarget.ALL_SALON_OWNERS:
        const salonOwners = await this.prisma.user.findMany({
          where: { role: UserRole.SALON_OWNER },
          select: { id: true },
        });
        targetUserIds = salonOwners.map((u) => u.id);
        break;

      case BroadcastTarget.ALL_ADMINS:
        const admins = await this.prisma.user.findMany({
          where: { role: UserRole.ADMIN },
          select: { id: true },
        });
        targetUserIds = admins.map((u) => u.id);
        break;

      case BroadcastTarget.SPECIFIC_USERS:
        if (!userIds || userIds.length === 0) {
          throw new BadRequestException('User IDs are required for SPECIFIC_USERS target');
        }
        targetUserIds = userIds;
        break;

      case BroadcastTarget.BY_ROLE:
        if (!role) {
          throw new BadRequestException('Role is required for BY_ROLE target');
        }
        const usersByRole = await this.prisma.user.findMany({
          where: { role },
          select: { id: true },
        });
        targetUserIds = usersByRole.map((u) => u.id);
        break;

      case BroadcastTarget.BY_SALON:
        if (!salonIds || salonIds.length === 0) {
          throw new BadRequestException('Salon IDs are required for BY_SALON target');
        }
        // Get all customers who have subscriptions to these salons
        const subscriptions = await this.prisma.subscription.findMany({
          where: {
            package: {
              salonId: { in: salonIds },
            },
          },
          include: {
            customer: {
              select: {
                userId: true,
              },
            },
          },
        });
        targetUserIds = [...new Set(subscriptions.map((s) => s.customer.userId))];
        break;

      case BroadcastTarget.ACTIVE_USERS:
        const activeUsers = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        targetUserIds = activeUsers.map((u) => u.id);
        break;

      case BroadcastTarget.INACTIVE_USERS:
        const inactiveUsers = await this.prisma.user.findMany({
          where: { isActive: false },
          select: { id: true },
        });
        targetUserIds = inactiveUsers.map((u) => u.id);
        break;

      default:
        throw new BadRequestException(`Unsupported broadcast target: ${target}`);
    }

    if (targetUserIds.length === 0) {
      return {
        success: true,
        message: 'No users found for the specified target',
        data: {
          sent: 0,
          failed: 0,
        },
      };
    }

    // Create notifications for all target users
    const notifications = targetUserIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      data: data || {},
    }));

    const result = await this.createBulk(notifications);

    // Send push notifications if enabled
    if (sendPush && this.firebaseApp) {
      try {
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: targetUserIds },
          },
          select: {
            id: true,
            notificationSettings: true,
          },
        });

        const tokens: string[] = [];
        for (const user of users) {
          const settings = (user.notificationSettings as any) || {};
          if (settings.fcmToken) {
            tokens.push(settings.fcmToken);
          }
        }

        if (tokens.length > 0) {
          await this.firebaseApp.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title,
              body: message,
            },
            data: {
              type: type.toString(),
              ...(data || {}),
            },
          });
        }
      } catch (error) {
        console.error('Error sending push notifications:', error);
      }
    }

    // Send email notifications if enabled
    if (sendEmail && this.transporter) {
      try {
        const users = await this.prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: { email: true },
        });

        const emailPromises = users.map((user) =>
          this.transporter.sendMail({
            from: this.configService.get<string>('email.from') || 'noreply@barberplatform.com',
            to: user.email,
            subject: title,
            text: message,
            html: `<p>${message}</p>`,
          }),
        );

        await Promise.allSettled(emailPromises);
      } catch (error) {
        console.error('Error sending email notifications:', error);
      }
    }

    // Send WebSocket notifications
    if (this.websocketNotificationService) {
      try {
        for (const userId of targetUserIds) {
          await this.websocketNotificationService.sendNotification(userId, {
            type,
            message: `${title}: ${message}`,
            data: data || {},
          });
        }
      } catch (error) {
        console.error('Error sending WebSocket notifications:', error);
      }
    }

    // result is BatchPayload which has count property
    const sentCount = result.count || 0;

    return {
      success: true,
      message: `Notification broadcasted to ${targetUserIds.length} users`,
      data: {
        sent: sentCount,
        failed: targetUserIds.length - sentCount,
        targetUserIds: targetUserIds.length,
      },
    };
  }

  /**
   * Schedule a notification to be sent at a specific time
   */
  async scheduleNotification(scheduleDto: ScheduleNotificationDto) {
    const { scheduledAt, timezone, repeat, repeatInterval, repeatUntil } = scheduleDto;

    // Store scheduled notification in database
    // For now, we'll use SystemSetting to store scheduled notifications
    // TODO: Create a proper ScheduledNotification model in the future
    const scheduledNotification = {
      title: scheduleDto.title,
      message: scheduleDto.message,
      type: scheduleDto.type || NotificationType.GENERAL,
      target: scheduleDto.target,
      userIds: scheduleDto.userIds,
      role: scheduleDto.role,
      salonIds: scheduleDto.salonIds,
      data: scheduleDto.data,
      sendPush: scheduleDto.sendPush,
      sendEmail: scheduleDto.sendEmail,
      scheduledAt: new Date(scheduledAt),
      timezone: timezone || 'UTC',
      repeat: repeat || false,
      repeatInterval: repeatInterval,
      repeatUntil: repeatUntil ? new Date(repeatUntil) : null,
      status: 'PENDING',
      createdAt: new Date(),
    };

    // Store in SystemSetting as JSON (temporary solution)
    const notificationId = `scheduled_${Date.now()}`;
    await this.prisma.systemSetting.upsert({
      where: { key: notificationId },
      update: {
        value: JSON.stringify(scheduledNotification),
        description: 'Scheduled notification',
      },
      create: {
        key: notificationId,
        value: JSON.stringify(scheduledNotification),
        description: 'Scheduled notification',
      },
    });

    return {
      success: true,
      message: 'Notification scheduled successfully',
      data: {
        id: notificationId,
        scheduledNotification,
        scheduledAt: new Date(scheduledAt),
      },
    };
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications() {
    const scheduledNotifications = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          startsWith: 'scheduled_',
        },
      },
    });

    const notifications = scheduledNotifications.map((setting) => {
      try {
        return {
          id: setting.key,
          ...JSON.parse(setting.value),
        };
      } catch {
        return null;
      }
    }).filter((n) => n !== null);

    return {
      success: true,
      data: notifications,
    };
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(notificationId: string) {
    await this.prisma.systemSetting.deleteMany({
      where: {
        key: notificationId,
      },
    });

    return {
      success: true,
      message: 'Scheduled notification cancelled',
    };
  }
}
