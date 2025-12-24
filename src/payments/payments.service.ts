import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { UnifiedPaymentHistoryService } from './services/unified-payment-history.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentGateway: PaymentGatewayService,
    private paymentHistory: UnifiedPaymentHistoryService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, customerId: number) {
    const { subscriptionId, amount, currency, paymentMethod } = createPaymentDto;

    // Verify subscription exists and belongs to customer
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        customerId,
      },
      include: {
        package: true,
      },
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId,
        amount,
        currency,
        paymentMethod,
        paymentId: `temp_${Date.now()}`, // Temporary ID until payment processor provides one
        status: PaymentStatus.PENDING,
      },
    });

    return payment;
  }

  async processStripePayment(processPaymentDto: ProcessPaymentDto, customerId: number) {
    const { paymentId, amount, currency } = processPaymentDto;

    // Get payment record
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: {
          include: {
            customer: true,
            package: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only process your own payments');
    }

    try {
      // Use unified payment gateway service
      const { clientSecret, paymentIntentId } = await this.paymentGateway.createStripePaymentIntent(
        amount,
        currency,
        {
          paymentId: paymentId.toString(),
          subscriptionId: payment.subscriptionId.toString(),
          customerId: customerId.toString(),
        },
      );

      // Update payment record with Stripe payment intent ID
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentId: paymentIntentId,
          status: PaymentStatus.PENDING,
        },
      });

      return {
        payment: updatedPayment,
        clientSecret,
      };
    } catch (error) {
      // Update payment record with failure
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: error.message,
        },
      });

      throw new BadRequestException(`Stripe payment failed: ${error.message}`);
    }
  }

  async processPayPalPayment(processPaymentDto: ProcessPaymentDto, customerId: number) {
    const { paymentId, amount, currency } = processPaymentDto;

    // Get payment record
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: {
          include: {
            customer: true,
            package: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.subscription.customerId !== customerId) {
      throw new ForbiddenException('You can only process your own payments');
    }

    try {
      const { paymentId: paypalPaymentId, approvalUrl } = await this.paymentGateway.createPayPalPayment(
        amount,
        currency,
        `Payment for subscription ${payment.subscriptionId}`,
        `${process.env.FRONTEND_URL}/payments/paypal/success`,
        `${process.env.FRONTEND_URL}/payments/paypal/cancel`,
      );

      // Update payment record with PayPal payment ID
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentId: paypalPaymentId,
          status: PaymentStatus.PENDING,
        },
      });

      return {
        payment: updatedPayment,
        approvalUrl,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: error.message,
        },
      });

      throw new BadRequestException(`PayPal payment failed: ${error.message}`);
    }
  }

  async executePayPalPayment(paypalPaymentId: string, payerId: string) {
    try {
      const result = await this.paymentGateway.executePayPalPayment(paypalPaymentId, payerId);

      // Find payment by PayPal payment ID
      const payment = await this.prisma.payment.findFirst({
        where: { paymentId: paypalPaymentId },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: result.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
            transactionId: result.transactionId,
          },
        });
      }

      return result;
    } catch (error) {
      throw new BadRequestException(`PayPal payment execution failed: ${error.message}`);
    }
  }

  async findAll(customerId?: number, status?: PaymentStatus) {
    const where: any = {};

    if (customerId) {
      where.subscription = {
        customerId,
      };
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        subscription: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
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
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async refund(id: number, amount?: number, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    const refundAmount = amount || payment.amount;

    try {
      let refund;
      if (payment.paymentMethod === 'stripe' || payment.paymentMethod === 'apple_pay' || payment.paymentMethod === 'google_pay') {
        const refundResult = await this.paymentGateway.refundStripePayment(
          payment.paymentId,
          refundAmount,
          reason,
        );
        refund = { id: refundResult.refundId, status: refundResult.status };
      } else {
        throw new BadRequestException('Refund method not supported');
      }

      // Update payment record
      const updatedPayment = await this.prisma.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundAmount,
          refundDate: new Date(),
        },
      });

      return {
        payment: updatedPayment,
        refund,
      };
    } catch (error) {
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  async getPaymentStatistics(customerId?: number, salonId?: number) {
    const where: any = {};

    if (customerId) {
      where.subscription = {
        customerId,
      };
    }

    if (salonId) {
      where.subscription = {
        package: {
          salonId,
        },
      };
    }

    const [
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      totalRevenue,
      averagePayment,
    ] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.COMPLETED } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.PENDING } }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _avg: { amount: true },
      }),
    ]);

    return {
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      averagePayment: averagePayment._avg.amount || 0,
    };
  }

  async getRecentPayments(limit = 10, customerId?: number) {
    const where: any = {};

    if (customerId) {
      where.subscription = {
        customerId,
      };
    }

    return this.prisma.payment.findMany({
      where,
      take: limit,
      include: {
        subscription: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * الحصول على بوابات الدفع المتاحة
   */
  getAvailableGateways() {
    return this.paymentGateway.getAvailableGateways();
  }

  /**
   * الحصول على سجل المدفوعات الموحد
   */
  getUnifiedPaymentHistory(options: {
    userId?: number;
    customerId?: number;
    salonId?: number;
    status?: PaymentStatus;
    paymentMethod?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    return this.paymentHistory.getUnifiedPaymentHistory(options);
  }

  /**
   * الحصول على إحصائيات شاملة
   */
  getComprehensiveStatistics(options: {
    userId?: number;
    customerId?: number;
    salonId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.paymentHistory.getComprehensiveStatistics(options);
  }

  /**
   * تصدير سجل المدفوعات
   */
  exportPaymentHistory(
    options: {
      userId?: number;
      customerId?: number;
      salonId?: number;
      startDate?: Date;
      endDate?: Date;
    },
    format: 'json' | 'csv' = 'json',
  ) {
    return this.paymentHistory.exportPaymentHistory(options, format);
  }

  /**
   * تأكيد الدفع بعد اكتماله
   */
  async confirmPayment(paymentId: number, gateway: 'stripe' | 'paypal') {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (gateway === 'stripe') {
      const paymentIntent = await this.paymentGateway.confirmStripePayment(payment.paymentId);
      
      if (paymentIntent.success) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.COMPLETED,
            transactionId: paymentIntent.paymentIntent.id,
          },
        });

        return {
          success: true,
          payment: await this.findOne(paymentId),
        };
      }
    }

    throw new BadRequestException('Payment confirmation failed');
  }

}