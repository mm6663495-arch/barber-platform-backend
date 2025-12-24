import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Payment Gateway Service - Unified Payment Gateway Interface
 * يدعم Stripe, PayPal, وطرق دفع أخرى
 */
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private stripe: Stripe | null = null;
  private paypalClientId: string;
  private paypalClientSecret: string;
  private paypalMode: string;

  constructor(private configService: ConfigService) {
    this.initializeGateways();
  }

  /**
   * تهيئة بوابات الدفع
   */
  private initializeGateways() {
    // تهيئة Stripe
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY') ||
      this.configService.get<string>('payment.stripe.secretKey');
    
    if (stripeSecretKey) {
      try {
        this.stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2025-02-24.acacia',
        });
        this.logger.log('✅ Stripe payment gateway initialized');
      } catch (error) {
        this.logger.error(`❌ Failed to initialize Stripe: ${error.message}`);
      }
    } else {
      this.logger.warn('⚠️ Stripe secret key not configured');
    }

    // تهيئة PayPal
    this.paypalClientId = this.configService.get<string>('PAYPAL_CLIENT_ID') ||
      this.configService.get<string>('payment.paypal.clientId') || '';
    this.paypalClientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET') ||
      this.configService.get<string>('payment.paypal.clientSecret') || '';
    this.paypalMode = this.configService.get<string>('PAYPAL_MODE') ||
      this.configService.get<string>('payment.paypal.mode') || 'sandbox';

    if (this.paypalClientId && this.paypalClientSecret) {
      this.logger.log('✅ PayPal payment gateway configured');
    } else {
      this.logger.warn('⚠️ PayPal credentials not configured');
    }
  }

  /**
   * التحقق من توفر بوابة دفع
   */
  isGatewayAvailable(gateway: 'stripe' | 'paypal' | 'apple_pay' | 'google_pay'): boolean {
    switch (gateway) {
      case 'stripe':
        return this.stripe !== null;
      case 'paypal':
        return !!(this.paypalClientId && this.paypalClientSecret);
      case 'apple_pay':
      case 'google_pay':
        // Apple Pay و Google Pay يعتمدان على Stripe
        return this.stripe !== null;
      default:
        return false;
    }
  }

  /**
   * الحصول على قائمة بوابات الدفع المتاحة
   */
  getAvailableGateways(): string[] {
    const gateways: string[] = [];
    
    if (this.stripe) {
      gateways.push('stripe', 'apple_pay', 'google_pay');
    }
    
    if (this.paypalClientId && this.paypalClientSecret) {
      gateways.push('paypal');
    }

    return gateways;
  }

  /**
   * إنشاء Payment Intent في Stripe
   */
  async createStripePaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, string>,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error(`Stripe payment intent creation failed: ${error.message}`);
      throw new BadRequestException(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * تأكيد Payment Intent في Stripe
   */
  async confirmStripePayment(
    paymentIntentId: string,
  ): Promise<{ success: boolean; paymentIntent: Stripe.PaymentIntent }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentIntent,
        };
      }

      throw new BadRequestException(`Payment not completed. Status: ${paymentIntent.status}`);
    } catch (error) {
      this.logger.error(`Stripe payment confirmation failed: ${error.message}`);
      throw new BadRequestException(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * إنشاء PayPal Payment
   */
  async createPayPalPayment(
    amount: number,
    currency: string,
    description: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ paymentId: string; approvalUrl: string }> {
    if (!this.paypalClientId || !this.paypalClientSecret) {
      throw new BadRequestException('PayPal is not configured');
    }

    // TODO: تنفيذ PayPal SDK integration
    // حالياً، PayPal معطل حتى يتم تكوين SDK بشكل صحيح
    throw new BadRequestException('PayPal payment processing is currently disabled. Please use Stripe.');
  }

  /**
   * تنفيذ PayPal Payment
   */
  async executePayPalPayment(
    paymentId: string,
    payerId: string,
  ): Promise<{ success: boolean; transactionId: string }> {
    if (!this.paypalClientId || !this.paypalClientSecret) {
      throw new BadRequestException('PayPal is not configured');
    }

    // TODO: تنفيذ PayPal SDK integration
    throw new BadRequestException('PayPal payment execution is currently disabled. Please use Stripe.');
  }

  /**
   * استرداد المبلغ (Refund) في Stripe
   */
  async refundStripePayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: (reason as any) || 'requested_by_customer',
      });

      return {
        refundId: refund.id,
        status: refund.status || 'succeeded',
      };
    } catch (error) {
      this.logger.error(`Stripe refund failed: ${error.message}`);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  /**
   * الحصول على تفاصيل Payment Intent
   */
  async getStripePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Failed to retrieve Stripe payment intent: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve payment: ${error.message}`);
    }
  }

  /**
   * التحقق من حالة الدفع
   */
  async verifyPaymentStatus(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    if (gateway === 'stripe') {
      const paymentIntent = await this.getStripePaymentIntent(paymentId);
      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
      };
    } else if (gateway === 'paypal') {
      // TODO: تنفيذ PayPal verification
      throw new BadRequestException('PayPal verification is currently disabled');
    }

    throw new BadRequestException(`Unsupported payment gateway: ${gateway}`);
  }
}

