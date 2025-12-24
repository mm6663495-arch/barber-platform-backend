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
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DataSyncService))
    private dataSyncService?: DataSyncService,
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto, customerId: number) {
    const { packageId, paymentMethod, paymentId, autoRenewal } = createSubscriptionDto;

    // Get package details
    const packageData = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            isActive: true,
            isApproved: true,
            ownerId: true,
          },
        },
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    // التحقق فقط من isActive، لأن isPublished قد يكون false في بعض الحالات
    if (!packageData.isActive) {
      throw new BadRequestException('Package is not available for subscription');
    }

    if (!packageData.salon.isActive || !packageData.salon.isApproved) {
      throw new BadRequestException('Salon is not available for subscription');
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + packageData.validityDays * 24 * 60 * 60 * 1000);

    // Generate unique QR code
    const qrCodeData = uuidv4();
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        customerId,
        packageId,
        qrCode: qrCodeData,
        visitsRemaining: packageData.visitsCount,
        startDate,
        endDate,
        status: SubscriptionStatus.ACTIVE,
        autoRenewal: autoRenewal || false,
        paymentMethod,
        paymentId,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
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

    // ⭐ إرسال إشعار للعميل عند إنشاء اشتراك
    try {
      await this.notificationsService.sendSubscriptionNotification(
        subscription.id,
        'created',
      );
    } catch (error) {
      this.logger.error(
        `Failed to send subscription notification to customer: ${error.message}`,
      );
    }

    // ⭐ إرسال إشعار للصالون عند إنشاء اشتراك
    try {
      await this.notificationsService.sendSubscriptionNotificationForSalon(
        subscription.id,
        'created',
      );
    } catch (error) {
      this.logger.error(
        `Failed to send subscription notification to salon owner: ${error.message}`,
      );
    }

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      const salonOwnerId = packageData.salon.ownerId;
      await this.dataSyncService.syncSubscription(
        subscription.id,
        'create',
        {
          status: subscription.status,
          packageId: subscription.packageId,
          customerId: subscription.customerId,
        },
        [customerId, salonOwnerId],
      );
    }

    return {
      success: true,
      message: 'Subscription created successfully',
      data: {
        ...subscription,
        qrCodeImage,
      },
    };
  }

  async findAll(customerId?: number, salonId?: number, status?: SubscriptionStatus) {
    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (salonId) {
      where.package = {
        salonId,
      };
    }

    if (status) {
      where.status = status;
    }

    let raw: any[];
    try {
      // Try to fetch with full includes first
      raw = await this.prisma.subscription.findMany({
        where,
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
                  address: true,
                },
              },
            },
          },
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      // If JSON parsing fails, use safe select instead of include
      if (error.message?.includes('JSON') || error.message?.includes('SyntaxError')) {
        console.warn('⚠️ JSON parsing error in subscriptions.findAll, using safe select');
        raw = await this.prisma.subscription.findMany({
          where,
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
            package: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                visitsCount: true,
                validityDays: true,
                salonId: true,
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
          orderBy: { createdAt: 'desc' },
        });
      } else {
        throw error;
      }
    }

    // حارس JSON لتجنب SyntaxError من Prisma عند وجود بيانات تالفة في DB
    const asArray = Array.isArray(raw) ? raw : [];
    const safeJson = <T>(value: any, fallback: T): T => {
      try {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      } catch {
        return fallback;
      }
    };

    return asArray.map((sub: any) => {
      const pkg = sub.package || {};
      const salon = (pkg && pkg.salon) || {};
      
      // Handle both include and select responses
      const hasServices = 'services' in pkg;
      const hasImages = 'images' in pkg;
      const hasSalonWorkingHours = 'workingHours' in salon;
      const hasSalonImages = 'images' in salon;
      
      return {
        ...sub,
        package: {
          ...pkg,
          // Only process JSON fields if they exist (from include), otherwise use defaults
          services: hasServices 
            ? safeJson(pkg.services, Array.isArray(pkg.services) ? pkg.services : [])
            : [],
          images: hasImages
            ? safeJson(pkg.images, Array.isArray(pkg.images) ? pkg.images : [])
            : [],
          salon: {
            ...salon,
            workingHours: hasSalonWorkingHours
              ? safeJson(salon.workingHours, typeof salon.workingHours === 'object' ? salon.workingHours : {})
              : {},
            images: hasSalonImages
              ? safeJson(salon.images, Array.isArray(salon.images) ? salon.images : [])
              : [],
          },
        },
      };
    });
  }

  async findOne(id: number) {
    const subscription = await this.prisma.subscription.findUnique({
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

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async findByQrCode(qrCode: string) {
    // ⭐ دعم QR code كـ JSON object أو UUID
    let subscriptionId: number | undefined;
    let searchQrCode: string = qrCode;

    // ⭐ محاولة تحليل QR code كـ JSON object
    try {
      // ⭐ فك ترميز URL إذا كان مُرمّزاً (قد يكون مُرمّزاً عدة مرات)
      let decodedQrCode = qrCode;
      let decodeAttempts = 0;
      const maxDecodeAttempts = 3;
      
      while (decodeAttempts < maxDecodeAttempts) {
        try {
          const tempDecoded = decodeURIComponent(decodedQrCode);
          // ⭐ إذا لم يتغير النص بعد فك الترميز، نتوقف
          if (tempDecoded === decodedQrCode) {
            break;
          }
          decodedQrCode = tempDecoded;
          decodeAttempts++;
        } catch (e) {
          // إذا فشل فك الترميز، نتوقف
          break;
        }
      }

      this.logger.log(
        `[findByQrCode] Original QR code: ${qrCode.substring(0, 100)}...`,
      );
      this.logger.log(
        `[findByQrCode] Decoded QR code: ${decodedQrCode.substring(0, 100)}...`,
      );

      // ⭐ محاولة تحليل JSON
      if (decodedQrCode.startsWith('{') || decodedQrCode.startsWith('[')) {
        const qrData = JSON.parse(decodedQrCode);
        
        // ⭐ إذا كان JSON object يحتوي على subscriptionId
        if (qrData.subscriptionId) {
          const parsedId = typeof qrData.subscriptionId === 'number'
            ? qrData.subscriptionId
            : parseInt(String(qrData.subscriptionId), 10);
          
          if (!isNaN(parsedId)) {
            subscriptionId = parsedId;
            this.logger.log(
              `[findByQrCode] QR code is JSON object, extracted subscriptionId: ${subscriptionId}`,
            );
          } else {
            this.logger.warn(
              `[findByQrCode] Failed to parse subscriptionId from: ${qrData.subscriptionId}`,
            );
            subscriptionId = undefined;
          }
        }
      }
    } catch (e) {
      // ⭐ إذا لم يكن JSON، نستخدم QR code كما هو (UUID)
      this.logger.log(
        `[findByQrCode] QR code is not JSON (${e.message}), using as-is: ${qrCode.substring(0, 50)}...`,
      );
    }

    // ⭐ البحث عن subscription
    // استخدام any مؤقتاً لتجنب مشاكل TypeScript المعقدة
    let subscription: any = null;

    if (subscriptionId) {
      // ⭐ البحث باستخدام subscriptionId
      subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
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
          visits: {
            // ⭐ إرجاع جميع الزيارات (COMPLETED و PENDING) لأن الزيارة الجديدة تكون PENDING
            select: {
              id: true,
              serviceName: true, // ⭐ إرجاع serviceName لاستخراج الخدمات المستخدمة
              status: true, // ⭐ إرجاع status أيضاً
            },
          },
        },
      });
    } else {
      // ⭐ البحث باستخدام qrCode (UUID)
      subscription = await this.prisma.subscription.findUnique({
        where: { qrCode: searchQrCode },
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
          visits: {
            // ⭐ إرجاع جميع الزيارات (COMPLETED و PENDING) لأن الزيارة الجديدة تكون PENDING
            select: {
              id: true,
              serviceName: true, // ⭐ إرجاع serviceName لاستخراج الخدمات المستخدمة
              status: true, // ⭐ إرجاع status أيضاً
            },
          },
        },
      });
    }

    if (!subscription) {
      this.logger.warn(
        `[findByQrCode] Subscription not found for QR code: ${qrCode}`,
      );
      throw new NotFoundException('Invalid QR code');
    }

    // ⭐ TypeScript الآن يعرف أن subscription ليس null بعد التحقق أعلاه
    const foundSubscription = subscription;
    
    // ⭐ إضافة معلومات إضافية للاستجابة
    // ⭐ حساب عدد الزيارات المكتملة فقط (COMPLETED)
    const completedVisitsCount = foundSubscription.visits?.filter(
      (v: any) => v.status === 'COMPLETED'
    ).length || 0;
    const packageVisitsCount = foundSubscription.package?.visitsCount || 0;
    const endDate = foundSubscription.endDate;
    const isExpiredByDate = endDate && new Date(endDate) < new Date();
    
    // ⭐ إضافة معلومات التحقق إلى الاستجابة
    foundSubscription.completedVisitsCount = completedVisitsCount;
    foundSubscription.packageVisitsCount = packageVisitsCount;
    foundSubscription.isExpiredByDate = isExpiredByDate;
    foundSubscription.isExpiredByVisits = completedVisitsCount >= packageVisitsCount;
    
    this.logger.log(
      `[findByQrCode] Found subscription: ${foundSubscription.id} for QR code: ${qrCode.substring(0, 50)}... ` +
      `(completedVisits: ${completedVisitsCount}/${packageVisitsCount}, expiredByDate: ${isExpiredByDate})`,
    );

    return foundSubscription;
  }

  async update(id: number, updateSubscriptionDto: UpdateSubscriptionDto, customerId?: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if customer can update this subscription
    if (customerId && subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only update your own subscriptions');
    }

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: updateSubscriptionDto,
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
                address: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      const affectedUserIds = [
        updatedSubscription.customerId,
        updatedSubscription.package.salon.ownerId,
      ];
      await this.dataSyncService.syncSubscription(
        updatedSubscription.id,
        'update',
        {
          status: updatedSubscription.status,
          packageId: updatedSubscription.packageId,
          customerId: updatedSubscription.customerId,
        },
        affectedUserIds,
      );
    }

    return updatedSubscription;
  }

  async cancel(id: number, customerId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only cancel your own subscriptions');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can be cancelled');
    }

    const cancelledSubscription = await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CANCELLED },
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

    // ⭐ إرسال إشعار للصالون عند إلغاء اشتراك
    try {
      await this.notificationsService.sendSubscriptionNotificationForSalon(
        cancelledSubscription.id,
        'cancelled',
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation notification to salon owner: ${error.message}`,
      );
    }

    // ⭐ إرسال إشعار للعميل عند إلغاء اشتراك
    try {
      await this.notificationsService.sendSubscriptionNotification(
        cancelledSubscription.id,
        'expired', // نستخدم expired كـ type للإلغاء للعميل
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation notification to customer: ${error.message}`,
      );
    }

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      const affectedUserIds = [
        cancelledSubscription.customerId,
        cancelledSubscription.package.salon.ownerId,
      ];
      await this.dataSyncService.syncSubscription(
        cancelledSubscription.id,
        'update',
        {
          status: cancelledSubscription.status,
          packageId: cancelledSubscription.packageId,
          customerId: cancelledSubscription.customerId,
        },
        affectedUserIds,
      );
    }

    return cancelledSubscription;
  }

  async renew(id: number, customerId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        package: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only renew your own subscriptions');
    }

    if (subscription.status !== SubscriptionStatus.EXPIRED) {
      throw new BadRequestException('Only expired subscriptions can be renewed');
    }

    // Calculate new dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + subscription.package.validityDays * 24 * 60 * 60 * 1000);

    const renewedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        visitsUsed: 0,
        visitsRemaining: subscription.package.visitsCount,
      },
      include: {
        package: {
          include: {
            salon: true,
          },
        },
      },
    });

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      const affectedUserIds = [
        renewedSubscription.customerId,
        renewedSubscription.package.salon.ownerId,
      ];
      await this.dataSyncService.syncSubscription(
        renewedSubscription.id,
        'update',
        {
          status: renewedSubscription.status,
          packageId: renewedSubscription.packageId,
          customerId: renewedSubscription.customerId,
        },
        affectedUserIds,
      );
    }

    return renewedSubscription;
  }

  async useVisit(qrCode: string, ownerId: number, serviceName?: string) {
    // ⭐ استخدام Transaction مع Row-Level Locking لمنع Race Conditions
    return await this.prisma.$transaction(async (tx) => {
      // Get salon ID from owner ID
      const salon = await tx.salon.findFirst({
        where: { ownerId },
      select: { id: true },
    });

    if (!salon) {
      throw new BadRequestException('Salon not found for this owner');
    }

    const salonId = salon.id;
    
    // ⭐ دعم QR code كـ JSON object أو UUID مباشر
    let subscription: any = null;
    
    // ⭐ محاولة استخراج subscriptionId من QR code (يدعم JSON و Dart Map string)
    let subscriptionId: number | null = null;
    
    // محاولة 1: Parse كـ JSON
    try {
      const parsed = JSON.parse(qrCode);
      this.logger.log(`[useVisit] Parsed as JSON: ${JSON.stringify(parsed)}`);
      
      if (parsed && typeof parsed === 'object' && parsed.subscriptionId !== undefined && parsed.subscriptionId !== null) {
        subscriptionId = typeof parsed.subscriptionId === 'number' 
          ? parsed.subscriptionId 
          : parseInt(String(parsed.subscriptionId), 10);
      }
    } catch (e) {
      // محاولة 2: Parse كـ Dart Map string (مثل: {type: subscription_visit, subscriptionId: 38, ...})
      this.logger.log(`[useVisit] Not valid JSON, trying Dart Map format...`);
      
      // استخراج subscriptionId من Dart Map string باستخدام regex
      const match = qrCode.match(/subscriptionId\s*:\s*(\d+)/);
      if (match && match[1]) {
        subscriptionId = parseInt(match[1], 10);
        this.logger.log(`[useVisit] Extracted subscriptionId from Dart Map: ${subscriptionId}`);
      } else {
        this.logger.log(`[useVisit] Could not extract subscriptionId from: ${qrCode.substring(0, 100)}`);
      }
    }
    
    // إذا وجدنا subscriptionId، نبحث عن subscription
    if (subscriptionId && !isNaN(subscriptionId)) {
      this.logger.log(`[useVisit] Looking for subscription with ID: ${subscriptionId}`);
      
      subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              visitsCount: true,
              validityDays: true,
              services: true, // ⭐ إضافة services
              images: true,
              isActive: true,
              isPublished: true,
              salonId: true,
              salon: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  owner: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      
      if (subscription) {
        this.logger.log(`[useVisit] ✅ Found subscription by ID: ${subscriptionId}, status: ${subscription.status}, salonId: ${subscription.package?.salonId}`);
      } else {
        this.logger.warn(`[useVisit] ❌ Subscription not found with ID: ${subscriptionId}`);
      }
    } else {
      this.logger.log(`[useVisit] No subscriptionId found, will search by qrCode UUID`);
    }
    
    // إذا لم نجد subscription من JSON، نبحث بـ qrCode مباشرة
    if (!subscription) {
      this.logger.log(`[useVisit] Searching by qrCode: ${qrCode}`);
      subscription = await tx.subscription.findUnique({
        where: { qrCode },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              visitsCount: true,
              validityDays: true,
              services: true, // ⭐ إضافة services
              images: true,
              isActive: true,
              isPublished: true,
              salonId: true,
              salon: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  owner: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      
      if (subscription) {
        this.logger.log(`[useVisit] Found subscription by qrCode: ${qrCode}`);
      } else {
        this.logger.warn(`[useVisit] Subscription not found with qrCode: ${qrCode}`);
      }
    }

    if (!subscription) {
      this.logger.error(`[useVisit] Invalid QR code - not found by ID or qrCode: ${qrCode}`);
      throw new NotFoundException('Invalid QR code - Subscription not found');
    }

    this.logger.log(`[useVisit] Subscription found: ID=${subscription.id}, Status=${subscription.status}, SalonId=${subscription.package?.salonId}, OwnerSalonId=${salonId}`);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      this.logger.warn(`[useVisit] Subscription ${subscription.id} is not active. Status: ${subscription.status}`);
      throw new BadRequestException(`Subscription is not active. Current status: ${subscription.status}`);
    }

    if (!subscription.package || !subscription.package.salonId) {
      this.logger.error(`[useVisit] Subscription ${subscription.id} has no package or salonId`);
      throw new BadRequestException('Subscription package or salon information is missing');
    }

    if (subscription.package.salonId !== salonId) {
      this.logger.warn(`[useVisit] Subscription ${subscription.id} salonId (${subscription.package.salonId}) does not match owner salonId (${salonId})`);
      throw new BadRequestException(`This subscription is not valid for this salon. Subscription salon: ${subscription.package.salonId}, Your salon: ${salonId}`);
    }

    // ⭐ التحقق الصارم من عدد الزيارات قبل السماح بإنشاء زيارة جديدة
    const packageVisitsCount = subscription.package?.visitsCount || 0;
    
    if (packageVisitsCount <= 0) {
      throw new BadRequestException('الباقة لا تحتوي على زيارات صالحة');
    }

    // ⭐ التحقق من عدد الزيارات المكتملة (COMPLETED) - هذه هي الزيارات التي تم خصمها فعلياً
    const completedVisitsCount = await tx.visit.count({
      where: {
        subscriptionId: subscription.id,
        status: 'COMPLETED',
      },
    });

    this.logger.log(
      `[useVisit] ⚠️ Subscription ${subscription.id} validation: ` +
      `completedVisitsCount=${completedVisitsCount}, packageVisitsCount=${packageVisitsCount}, ` +
      `visitsUsed=${subscription.visitsUsed}, visitsRemaining=${subscription.visitsRemaining}`,
    );

    // ⭐ التحقق الصارم: عدد الزيارات المكتملة يجب أن يكون أقل من عدد الزيارات في الباقة
    if (completedVisitsCount >= packageVisitsCount) {
      this.logger.warn(
        `[useVisit] ❌ BLOCKED: Subscription ${subscription.id} has ${completedVisitsCount} completed visits, ` +
        `which equals or exceeds package visits count (${packageVisitsCount})`,
      );
      // ⭐ تحديث حالة الباقة إلى EXPIRED إذا لم تكن منتهية بالفعل
      if (subscription.status !== SubscriptionStatus.EXPIRED) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.EXPIRED,
            visitsRemaining: 0,
            visitsUsed: packageVisitsCount,
          },
        });
      }
      throw new BadRequestException(
        `تم استهلاك جميع الزيارات المتاحة في هذه الباقة.\n\n` +
        `عدد الزيارات المكتملة: ${completedVisitsCount} من ${packageVisitsCount}\n\n` +
        `لا يمكن إنشاء زيارة جديدة لأن جميع الزيارات تم استهلاكها. يرجى التواصل مع العميل لتجديد الباقة.`,
      );
    }

    // ⭐ التحقق من التناسق: visitsRemaining + visitsUsed يجب أن يساوي package.visitsCount
    const totalVisits = subscription.visitsRemaining + subscription.visitsUsed;
    if (totalVisits !== packageVisitsCount) {
      this.logger.warn(
        `[useVisit] ⚠️ Subscription ${subscription.id} has inconsistent visit counts: ` +
        `visitsRemaining=${subscription.visitsRemaining}, visitsUsed=${subscription.visitsUsed}, ` +
        `packageVisitsCount=${packageVisitsCount}, total=${totalVisits}, completedVisits=${completedVisitsCount}`,
      );
      // ⭐ تصحيح البيانات بناءً على عدد الزيارات المكتملة الفعلي
      const correctedVisitsUsed = completedVisitsCount;
      const correctedVisitsRemaining = Math.max(0, packageVisitsCount - correctedVisitsUsed);
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          visitsRemaining: correctedVisitsRemaining,
          visitsUsed: correctedVisitsUsed,
          // ⭐ إذا لم تعد هناك زيارات متبقية، انتهت الباقة
          status: correctedVisitsRemaining === 0 ? SubscriptionStatus.EXPIRED : subscription.status,
        },
      });
      // ⭐ تحديث subscription object
      subscription.visitsRemaining = correctedVisitsRemaining;
      subscription.visitsUsed = correctedVisitsUsed;
      subscription.status = correctedVisitsRemaining === 0 ? SubscriptionStatus.EXPIRED : subscription.status;
      
      // ⭐ إذا تم تصحيح البيانات وأصبحت الباقة منتهية، نرفض الطلب
      if (correctedVisitsRemaining <= 0) {
        throw new BadRequestException('لا توجد زيارات متبقية في هذه الباقة');
      }
    }

    // ⭐ التحقق الصارم: يجب أن يكون visitsUsed < package.visitsCount
    if (subscription.visitsUsed >= packageVisitsCount) {
      throw new BadRequestException(
        `تم استخدام جميع الزيارات المتاحة في هذه الباقة (${packageVisitsCount} زيارة)`,
      );
    }

    // ⭐ التحقق من أن هناك زيارات متبقية
    if (subscription.visitsRemaining <= 0) {
      throw new BadRequestException('لا توجد زيارات متبقية في هذه الباقة');
    }

    // ⭐ التحقق الإضافي: التحقق من عدد الزيارات المكتملة + الزيارات PENDING
    // هذا يمنع إنشاء زيارة جديدة إذا كان هناك زيارات PENDING كافية لاستهلاك جميع الزيارات
    const pendingVisitsCount = await tx.visit.count({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `[useVisit] ⚠️ Subscription ${subscription.id} pending visits check: ` +
      `completedVisitsCount=${completedVisitsCount}, pendingVisitsCount=${pendingVisitsCount}, ` +
      `packageVisitsCount=${packageVisitsCount}, total=${completedVisitsCount + pendingVisitsCount}`,
    );

    // ⭐ إذا كان عدد الزيارات المكتملة + الزيارات PENDING >= عدد الزيارات في الباقة، نرفض الطلب
    if (completedVisitsCount + pendingVisitsCount >= packageVisitsCount) {
      this.logger.warn(
        `[useVisit] ❌ BLOCKED: Subscription ${subscription.id} has ${completedVisitsCount} completed + ` +
        `${pendingVisitsCount} pending = ${completedVisitsCount + pendingVisitsCount} visits, ` +
        `which equals or exceeds package visits count (${packageVisitsCount})`,
      );
      throw new BadRequestException(
        `لا يمكن إنشاء زيارة جديدة.\n\n` +
        `عدد الزيارات المكتملة: ${completedVisitsCount}\n` +
        `عدد الزيارات المعلقة: ${pendingVisitsCount}\n` +
        `إجمالي: ${completedVisitsCount + pendingVisitsCount} من ${packageVisitsCount}\n\n` +
        `جميع الزيارات المتاحة تم استهلاكها أو محجوزة. يرجى التواصل مع العميل لتجديد الباقة.`,
      );
    }

    // ⭐ لا نخصم زيارة الآن - سنخصمها فقط عند إكمال الزيارة
    // نترك subscription كما هو بدون تحديث

    // ⭐ الحصول على الخدمات المستخدمة سابقاً في هذا الاشتراك
    // ⚠️ نحذف الخدمة فقط من الزيارات المكتملة (COMPLETED)، وليس من PENDING أو CANCELLED
    const previousVisits = await tx.visit.findMany({
      where: {
        subscriptionId: subscription.id,
        serviceName: { not: null },
        status: 'COMPLETED', // ⭐ فقط الزيارات المكتملة
      },
      select: {
        serviceName: true,
      },
    });

    const usedServices = previousVisits
      .map((v: any) => v.serviceName)
      .filter((s): s is string => s !== null && s !== '');

    // ⭐ Create visit record بحالة PENDING (بدون خصم زيارة)
    const visit = await tx.visit.create({
      data: {
        subscriptionId: subscription.id,
        salonId,
        visitDate: new Date(),
        visitTime: new Date(),
        serviceName: serviceName || null, // ⭐ حفظ اسم الخدمة المختارة
        status: 'PENDING', // ⭐ إنشاء الزيارة بحالة PENDING
      } as any,
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
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                visitsCount: true,
                validityDays: true,
                services: true, // ⭐ إضافة services
                images: true,
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

    // ⭐ إضافة قائمة الخدمات المستخدمة إلى الاستجابة
    (visit as any).usedServices = usedServices;

    // ⭐ لا نتحقق من انتهاء الباقة هنا - سنتحقق عند إكمال الزيارة

    // ⭐ إرسال إشعار للصالون عند تسجيل زيارة
    try {
      await this.notificationsService.sendVisitNotificationForSalon(visit.id);
    } catch (error) {
      this.logger.error(
        `Failed to send visit notification to salon owner: ${error.message}`,
      );
    }

    // ⭐ إرسال حدث مزامنة للاشتراك
    // ⚠️ ملاحظة: لا نحدث الاشتراك الآن - سنحدثه عند إكمال الزيارة
    if (this.dataSyncService) {
      const affectedUserIds = [
        subscription.customerId,
        subscription.package.salon.ownerId,
      ];
      await this.dataSyncService.syncSubscription(
        subscription.id,
        'update',
        {
          status: subscription.status,
          visitsRemaining: subscription.visitsRemaining,
          visitsUsed: subscription.visitsUsed,
        },
        affectedUserIds,
      );

      // ⭐ إرسال حدث مزامنة للزيارة
      await this.dataSyncService.syncVisit(
        visit.id,
        'create',
        {
          subscriptionId: visit.subscriptionId,
          salonId: visit.salonId,
          visitDate: visit.visitDate,
        },
        affectedUserIds,
      );
    }

    // ⭐ لا نرسل إشعار للعميل عند إنشاء زيارة pending
    // الإشعار سيُرسل عند إكمال الزيارة في updateVisitStatus

    return visit;
    }); // ⭐ إغلاق Transaction
  }

  async confirmVisit(visitId: number) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'CONFIRMED' },
    });
  }

  async completeVisit(visitId: number) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED' },
    });
  }

  async cancelVisit(visitId: number) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'CANCELLED' },
    });
  }

  // ⭐ الحصول على زيارات عميل
  async getCustomerVisits(
    userId: number,
    date?: string,
    status?: string,
  ) {
    // البحث عن العميل من userId
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });

    // إذا لم يكن هناك Customer، نرجع قائمة فارغة بدلاً من خطأ
    if (!customer) {
      return [];
    }

    // البحث عن جميع الاشتراكات للعميل
    const subscriptions = await this.prisma.subscription.findMany({
      where: { customerId: customer.id },
      select: { id: true },
    });

    const subscriptionIds = subscriptions.map((s) => s.id);

    if (subscriptionIds.length === 0) {
      return [];
    }

    const where: any = {
      subscriptionId: { in: subscriptionIds },
    };

    // فلترة حسب التاريخ
    if (date) {
      const visitDate = new Date(date);
      const startOfDay = new Date(
        visitDate.getFullYear(),
        visitDate.getMonth(),
        visitDate.getDate(),
      );
      const endOfDay = new Date(
        visitDate.getFullYear(),
        visitDate.getMonth(),
        visitDate.getDate(),
        23,
        59,
        59,
      );
      where.visitDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // فلترة حسب الحالة
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const visits = await this.prisma.visit.findMany({
      where,
      include: {
        subscription: {
          include: {
            package: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        visitDate: 'desc',
      },
    });

    return visits;
  }

  // ⭐ الحصول على زيارات صالون
  async getSalonVisits(
    salonId: number,
    ownerId: number,
    date?: string,
    dateRange?: string, // ⭐ 'all', 'today', 'lastMonth'
    status?: string,
  ) {
    // التحقق من أن الصالون يخص المستخدم
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (salon.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only view visits for your own salon',
      );
    }

    const where: any = {
      salonId,
    };

    // ⭐ فلترة حسب dateRange (أولوية أعلى من date)
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      if (dateRange === 'today') {
        // فلترة زيارات اليوم فقط
        const startOfDay = new Date(today);
        const endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        );
        where.visitDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      } else if (dateRange === 'lastMonth') {
        // فلترة زيارات آخر 30 يوم
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        );
        where.visitDate = {
          gte: thirtyDaysAgo,
          lte: endOfDay,
        };
      }
      // إذا كان dateRange === 'all'، لا نضيف فلترة تاريخية (نعرض كل الزيارات)
    } else if (date) {
      // فلترة حسب تاريخ محدد (إذا تم تمريره)
      const visitDate = new Date(date);
      const startOfDay = new Date(
        visitDate.getFullYear(),
        visitDate.getMonth(),
        visitDate.getDate(),
      );
      const endOfDay = new Date(
        visitDate.getFullYear(),
        visitDate.getMonth(),
        visitDate.getDate(),
        23,
        59,
        59,
        999,
      );
      where.visitDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    // إذا لم يتم تحديد dateRange أو date، نعرض كل الزيارات (لا فلترة تاريخية)

    // فلترة حسب الحالة
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    return this.prisma.visit.findMany({
      where,
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
                price: true,
                visitsCount: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
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
      orderBy: { visitDate: 'desc' },
    });
  }

  // ⭐ الحصول على تفاصيل زيارة
  async getVisitById(visitId: number) {
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
              },
            },
            package: {
              select: {
                id: true,
                name: true,
                price: true,
                visitsCount: true,
              },
            },
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            response: true,
          },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    return visit;
  }

  async getCustomerSubscriptions(customerId: number, status?: SubscriptionStatus) {
    const where: any = { customerId };
    if (status) {
      where.status = status;
    }

    // ⭐ جلب جميع الباقات مع package.validityDays
    const allSubscriptions = await this.prisma.subscription.findMany({
      where,
      include: {
        package: {
          select: {
            id: true,
            name: true,
            validityDays: true, // ⭐ نحتاج validityDays للفلترة
          },
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
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ⭐ فلترة الباقات المنتهية بناءً على validityDays من كل باقة
    const now = new Date();
    const filteredSubscriptions = allSubscriptions.filter((subscription) => {
      // الباقات النشطة أو المعلقة أو الملغاة تظهر دائماً
      if (subscription.status !== SubscriptionStatus.EXPIRED) {
        return true;
      }

      // للباقات المنتهية: نحسب تاريخ الحذف (endDate + validityDays)
      const validityDays = subscription.package.validityDays || 30; // fallback إلى 30 يوم
      const deleteDate = new Date(subscription.endDate);
      deleteDate.setDate(deleteDate.getDate() + validityDays);
      deleteDate.setHours(0, 0, 0, 0);

      // إذا كان تاريخ الحذف بعد اليوم، نعرض الباقة
      return deleteDate >= now;
    });

    return filteredSubscriptions;
  }

  async getSalonSubscriptions(salonId: number, status?: SubscriptionStatus) {
    const where: any = {
      package: {
        salonId,
      },
    };

    if (status) {
      where.status = status;
    }

    // ⭐ جلب جميع الباقات مع package.validityDays
    const allSubscriptions = await this.prisma.subscription.findMany({
      where,
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
            price: true,
            visitsCount: true,
            validityDays: true, // ⭐ نحتاج validityDays للفلترة
            salonId: true, // ⭐ إضافة salonId للفلترة في الـ frontend
          },
        },
        visits: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ⭐ فلترة الباقات المنتهية بناءً على validityDays من كل باقة
    const now = new Date();
    const filteredSubscriptions = allSubscriptions.filter((subscription) => {
      // الباقات النشطة أو المعلقة أو الملغاة تظهر دائماً
      if (subscription.status !== SubscriptionStatus.EXPIRED) {
        return true;
      }

      // للباقات المنتهية: نحسب تاريخ الحذف (endDate + validityDays)
      const validityDays = subscription.package.validityDays || 30; // fallback إلى 30 يوم
      const deleteDate = new Date(subscription.endDate);
      deleteDate.setDate(deleteDate.getDate() + validityDays);
      deleteDate.setHours(0, 0, 0, 0);

      // إذا كان تاريخ الحذف بعد اليوم، نعرض الباقة
      return deleteDate >= now;
    });

    return filteredSubscriptions;
  }

  async getSubscriptionStatistics(customerId?: number, salonId?: number) {
    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (salonId) {
      where.package = {
        salonId,
      };
    }

    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.count({ where: { ...where, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { ...where, status: SubscriptionStatus.EXPIRED } }),
      this.prisma.subscription.count({ where: { ...where, status: SubscriptionStatus.CANCELLED } }),
      this.prisma.subscription.aggregate({
        where: {
          ...where,
          status: SubscriptionStatus.ACTIVE,
        },
        _sum: {
          packageId: true,
        },
      }),
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue: totalRevenue._sum.packageId || 0,
    };
  }

  async checkExpiredSubscriptions() {
    const now = new Date();
    
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lt: now,
        },
      },
    });

    if (expiredSubscriptions.length > 0) {
      await this.prisma.subscription.updateMany({
        where: {
          id: {
            in: expiredSubscriptions.map(sub => sub.id),
          },
        },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });
    }

    return {
      expiredCount: expiredSubscriptions.length,
      expiredSubscriptions: expiredSubscriptions.map(sub => sub.id),
    };
  }

  // ⭐ الحصول على عملاء صالون محدد
  async getSalonCustomers(
    salonId: number,
    ownerId: number,
    status?: string,
  ) {
    // التحقق من أن الصالون يخص المستخدم
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (salon.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only view customers for your own salon',
      );
    }

    // الحصول على جميع الاشتراكات للصالون
    const where: any = {
      package: {
        salonId: salonId,
      },
    };

    // فلترة حسب حالة الاشتراك
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      include: {
        customer: {
          include: {
            subscriptions: {
              where: {
                package: {
                  salonId: salonId,
                },
              },
              include: {
                package: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                  },
                },
                visits: {
                  select: {
                    id: true,
                    visitDate: true,
                    visitTime: true,
                    status: true,
                  },
                  orderBy: {
                    visitDate: 'desc',
                  },
                },
              },
            },
            reviews: {
              where: {
                salonId: salonId,
              },
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // تجميع العملاء وإزالة التكرارات
    const customersMap = new Map();

    for (const subscription of subscriptions) {
      const customerId = subscription.customer.id.toString();
      
      if (!customersMap.has(customerId)) {
        const customer = subscription.customer;
        
        // حساب إحصائيات العميل
        const customerSubscriptions = customer.subscriptions || [];
        const allVisits: any[] = [];
        
        customerSubscriptions.forEach((sub: any) => {
          if (sub.visits) {
            allVisits.push(...sub.visits);
          }
        });

        // حساب إجمالي المبلغ المنفق
        const totalSpent = customerSubscriptions.reduce(
          (sum: number, sub: any) => sum + (sub.package?.price || 0),
          0,
        );

        // حساب آخر زيارة
        const sortedVisits = [...allVisits].sort(
          (a, b) =>
            new Date(b.visitDate || b.visitTime).getTime() -
            new Date(a.visitDate || a.visitTime).getTime(),
        );

        // ⭐ حساب الزيارات بدون الملغية
        const validVisits = allVisits.filter((v: any) => v.status !== 'CANCELLED');
        
        customersMap.set(customerId, {
          ...customer,
          subscriptions: customerSubscriptions,
          totalVisits: validVisits.length, // ⭐ بدون الزيارات الملغية
          totalSpent,
          lastVisitDate: sortedVisits[0]?.visitDate || sortedVisits[0]?.visitTime || null,
          activeSubscriptions: customerSubscriptions.filter(
            (sub: any) => sub.status === 'ACTIVE',
          ).length,
          _count: {
            visits: validVisits.length, // ⭐ بدون الزيارات الملغية
            subscriptions: customerSubscriptions.length,
          },
        });
      }
    }

    return Array.from(customersMap.values());
  }

  /**
   * الحصول على سجل زيارات العميل للصالون (للمالك)
   */
  async getCustomerVisitsForSalon(
    customerId: number,
    salonOwnerId: number,
    salonId?: number,
    page: number = 1,
    limit: number = 10,
  ) {
    // التحقق من أن الصالون يخص المالك
    const whereClause: any = {
      subscription: {
        customerId,
        package: {
          salon: {
            ownerId: salonOwnerId,
          },
        },
      },
    };

    if (salonId) {
      whereClause.subscription.package.salonId = salonId;
    }

    const skip = (page - 1) * limit;

    const [visits, total] = await Promise.all([
      this.prisma.visit.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          visitDate: 'desc',
        },
        include: {
          subscription: {
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  images: true,
                },
              },
            },
          },
          review: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.visit.count({ where: whereClause }),
    ]);

    return {
      success: true,
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
   * الحصول على تفضيلات العميل
   */
  async getCustomerPreferences(customerId: number, salonOwnerId: number) {
    // التحقق من أن العميل لديه اشتراكات في صالونات المالك
    const customerSubscriptions = await this.prisma.subscription.findFirst({
      where: {
        customerId,
        package: {
          salon: {
            ownerId: salonOwnerId,
          },
        },
      },
    });

    if (!customerSubscriptions) {
      throw new NotFoundException(
        'Customer has no subscriptions in your salons',
      );
    }

    // جلب المفضلة (صالونات وباقات)
    const favorites = await this.prisma.favorite.findMany({
      where: {
        customerId,
      },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            images: true,
            salon: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // جلب الباقات المفضلة
    const favoritePackages = favorites.filter((f) => f.packageId != null);
    const favoriteSalons = favorites.filter((f) => f.salonId != null);

    // جلب قوائم المفضلة المخصصة
    const favoriteLists = await this.prisma.favoriteList.findMany({
      where: {
        customerId,
      },
      include: {
        favorites: {
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
            package: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        favoritePackages,
        favoriteSalons,
        favoriteLists,
        totalFavorites: favorites.length,
      },
    };
  }

  /**
   * الحصول على تاريخ مشتريات العميل
   */
  async getCustomerPurchaseHistory(
    customerId: number,
    salonOwnerId: number,
    salonId?: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const whereClause: any = {
      customerId,
      package: {
        salon: {
          ownerId: salonOwnerId,
        },
      },
    };

    if (salonId) {
      whereClause.package.salonId = salonId;
    }

    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              images: true,
              salon: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paymentMethod: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          visits: {
            select: {
              id: true,
              status: true,
              visitDate: true,
            },
            orderBy: {
              visitDate: 'desc',
            },
          },
        },
      }),
      this.prisma.subscription.count({ where: whereClause }),
    ]);

    // حساب إجمالي المدفوعات لكل اشتراك
    const subscriptionsWithTotals = subscriptions.map((sub) => {
      const totalPaid = sub.payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // ⭐ حساب الزيارات بدون الملغية
      const validVisits = sub.visits.filter((v) => v.status !== 'CANCELLED');
      const totalVisits = validVisits.length;
      const completedVisits = validVisits.filter(
        (v) => v.status === 'COMPLETED',
      ).length;

      // استخدام visitsUsed من الاشتراك أو عدد الزيارات الفعلية (بدون الملغية)
      const subscriptionTotalVisits = (sub as any).visitsUsed || totalVisits;

      return {
        ...sub,
        totalPaid: Number(totalPaid),
        totalVisits,
        completedVisits,
        remainingVisits: subscriptionTotalVisits - completedVisits,
      };
    });

    return {
      success: true,
      data: subscriptionsWithTotals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
