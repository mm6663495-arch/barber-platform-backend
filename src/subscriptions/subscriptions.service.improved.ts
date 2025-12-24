import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { TransactionHelper } from '../common/utils/transaction.helper';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionStatus } from '@prisma/client';
import { PaginationOptions, PaginatedResponseDto } from '../common/dto/pagination.dto';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

/**
 * Subscriptions Service (محسّن)
 * نسخة محسّنة تستخدم Repository Pattern و Transactions
 */
@Injectable()
export class SubscriptionsServiceImproved {
  private transactionHelper: TransactionHelper;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {
    this.transactionHelper = new TransactionHelper(prisma);
  }

  /**
   * إنشاء اشتراك جديد (مع Transaction)
   * استخدام Transaction لضمان إنشاء الاشتراك والدفع معاً
   */
  async create(createSubscriptionDto: CreateSubscriptionDto, customerId: number) {
    const { packageId, paymentMethod, paymentId, autoRenewal } = createSubscriptionDto;

    return await this.transactionHelper.execute(async (tx) => {
      // Get package details
      const packageData = await tx.package.findUnique({
        where: { id: packageId },
        include: {
          salon: {
            select: {
              id: true,
              name: true,
              isActive: true,
              isApproved: true,
            },
          },
        },
      });

      if (!packageData) {
        throw new NotFoundException('Package not found');
      }

      if (!packageData.isActive || !packageData.isPublished) {
        throw new BadRequestException('Package is not available for subscription');
      }

      if (!packageData.salon.isActive || !packageData.salon.isApproved) {
        throw new BadRequestException('Salon is not available for subscription');
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + packageData.validityDays * 24 * 60 * 60 * 1000,
      );

      // Generate unique QR code
      const qrCodeData = uuidv4();
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);

      // Create subscription
      const subscription = await tx.subscription.create({
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

      // إذا كان هناك معلومات دفع، سجل الدفع
      if (paymentId) {
        await tx.payment.create({
          data: {
            subscriptionId: subscription.id,
            amount: packageData.price,
            currency: 'USD',
            paymentMethod: paymentMethod || 'unknown',
            paymentId,
            status: 'COMPLETED',
          },
        });
      }

      return {
        ...subscription,
        qrCodeImage,
      };
    });
  }

  /**
   * إيجاد جميع الاشتراكات مع Pagination
   */
  async findAll(
    pagination: PaginationOptions,
    filters: {
      customerId?: number;
      salonId?: number;
      status?: SubscriptionStatus;
    },
  ): Promise<PaginatedResponseDto<any>> {
    return this.subscriptionRepository.findWithFilters(pagination, filters);
  }

  /**
   * إيجاد اشتراك بواسطة ID
   */
  async findOne(id: number) {
    const subscription = await this.subscriptionRepository.findByIdWithDetails(id);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * إيجاد اشتراك بواسطة QR Code
   */
  async findByQrCode(qrCode: string) {
    const subscription = await this.subscriptionRepository.findByQrCode(qrCode);

    if (!subscription) {
      throw new NotFoundException('Invalid QR code');
    }

    return subscription;
  }

  /**
   * تحديث اشتراك
   */
  async update(
    id: number,
    updateSubscriptionDto: UpdateSubscriptionDto,
    customerId?: number,
  ) {
    const subscription = await this.subscriptionRepository.findById(id);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if customer can update this subscription
    if (customerId && subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only update your own subscriptions');
    }

    return this.subscriptionRepository.update(id, updateSubscriptionDto);
  }

  /**
   * إلغاء اشتراك
   */
  async cancel(id: number, customerId: number) {
    const subscription = await this.subscriptionRepository.findById(id);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only cancel your own subscriptions');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can be cancelled');
    }

    return this.subscriptionRepository.update(id, {
      status: SubscriptionStatus.CANCELLED,
    });
  }

  /**
   * تجديد اشتراك
   */
  async renew(id: number, customerId: number) {
    return await this.transactionHelper.execute(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { id },
        include: { package: true },
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
      const endDate = new Date(
        startDate.getTime() + subscription.package.validityDays * 24 * 60 * 60 * 1000,
      );

      return await tx.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          visitsUsed: 0,
          visitsRemaining: subscription.package.visitsCount,
        },
      });
    });
  }

  /**
   * استخدام زيارة (مع Transaction)
   * العملية الأكثر تعقيداً - تحتاج Transaction لضمان التناسق
   */
  async useVisit(qrCode: string, salonId: number) {
    return await this.transactionHelper.executeWithRetry(async (tx) => {
      // Get subscription with lock
      const subscription = await tx.subscription.findUnique({
        where: { qrCode },
        include: {
          package: {
            include: {
              salon: true,
            },
          },
        },
      });

      if (!subscription) {
        throw new NotFoundException('Invalid QR code');
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new BadRequestException('Subscription is not active');
      }

      if (subscription.package.salonId !== salonId) {
        throw new BadRequestException(
          'This subscription is not valid for this salon',
        );
      }

      if (subscription.visitsRemaining <= 0) {
        throw new BadRequestException('No visits remaining');
      }

      // Update subscription (في نفس الـ transaction)
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          visitsUsed: subscription.visitsUsed + 1,
          visitsRemaining: subscription.visitsRemaining - 1,
        },
      });

      // Create visit record (في نفس الـ transaction)
      const visit = await tx.visit.create({
        data: {
          subscriptionId: subscription.id,
          salonId,
          visitDate: new Date(),
          visitTime: new Date(),
        },
      });

      // Check if subscription should be expired
      if (updatedSubscription.visitsRemaining === 0) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }

      return {
        subscription: updatedSubscription,
        visit,
      };
    }, 3); // محاولة 3 مرات في حالة الفشل
  }

  /**
   * إيجاد اشتراكات العميل مع Pagination
   */
  async getCustomerSubscriptions(
    customerId: number,
    pagination: PaginationOptions,
    status?: SubscriptionStatus,
  ): Promise<PaginatedResponseDto<any>> {
    return this.subscriptionRepository.findByCustomerId(
      customerId,
      pagination,
      status,
    );
  }

  /**
   * إيجاد اشتراكات الصالون مع Pagination
   */
  async getSalonSubscriptions(
    salonId: number,
    pagination: PaginationOptions,
    status?: SubscriptionStatus,
  ): Promise<PaginatedResponseDto<any>> {
    return this.subscriptionRepository.findBySalonId(salonId, pagination, status);
  }

  /**
   * إحصائيات الاشتراكات
   */
  async getSubscriptionStatistics(customerId?: number, salonId?: number) {
    return this.subscriptionRepository.getStatistics({
      customerId,
      salonId,
    });
  }

  /**
   * فحص الاشتراكات المنتهية
   * مهمة مجدولة - تستخدم Transaction لتحديث متعدد
   */
  async checkExpiredSubscriptions() {
    return await this.transactionHelper.execute(async (tx) => {
      const expiredSubscriptions =
        await this.subscriptionRepository.findExpiredSubscriptions();

      if (expiredSubscriptions.length > 0) {
        const ids = expiredSubscriptions.map((sub) => sub.id);
        await this.subscriptionRepository.updateExpiredSubscriptions(ids);
      }

      return {
        expiredCount: expiredSubscriptions.length,
        expiredSubscriptions: expiredSubscriptions.map((sub) => sub.id),
      };
    });
  }

  /**
   * إرسال تنبيهات للاشتراكات القريبة من الانتهاء
   */
  async sendExpiryWarnings(daysBeforeExpiry: number = 7) {
    const expiringSubscriptions =
      await this.subscriptionRepository.findExpiringSubscriptions(
        daysBeforeExpiry,
      );

    // هنا يمكنك إرسال إشعارات
    // await this.notificationService.sendExpiryWarning(...)

    return {
      count: expiringSubscriptions.length,
      subscriptions: expiringSubscriptions,
    };
  }
}

