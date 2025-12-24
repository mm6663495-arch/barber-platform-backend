import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS Service - Unified SMS Notification Service
 * يدعم Twilio وخدمات SMS أخرى
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: any;
  private isEnabled: boolean = false;

  constructor(private configService: ConfigService) {
    this.initializeSmsService();
  }

  /**
   * تهيئة خدمة SMS
   */
  private initializeSmsService() {
    try {
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

      if (accountSid && authToken && fromNumber) {
        // Dynamic import for Twilio
        const twilio = require('twilio');
        this.twilioClient = twilio(accountSid, authToken);
        this.isEnabled = true;
        this.logger.log('SMS Service initialized successfully (Twilio)');
      } else {
        this.logger.warn('SMS configuration is incomplete, SMS notifications will be disabled');
        this.isEnabled = false;
      }
    } catch (error) {
      this.logger.error(`Failed to initialize SMS service: ${error.message}`);
      this.isEnabled = false;
    }
  }

  /**
   * إرسال رسالة SMS
   */
  async sendSms(to: string, message: string): Promise<boolean> {
    if (!this.isEnabled || !this.twilioClient) {
      this.logger.warn('SMS service is not enabled, skipping SMS send');
      return false;
    }

    try {
      const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      
      if (!fromNumber) {
        this.logger.error('TWILIO_PHONE_NUMBER is not configured');
        return false;
      }

      // تنظيف رقم الهاتف (إزالة المسافات والرموز)
      const cleanPhone = this.cleanPhoneNumber(to);

      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: cleanPhone,
      });

      this.logger.log(`SMS sent successfully to ${cleanPhone}: ${result.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      return false;
    }
  }

  /**
   * إرسال رسائل SMS متعددة
   */
  async sendBulkSms(phoneNumbers: string[], message: string): Promise<{ success: number; failed: number }> {
    if (!this.isEnabled) {
      this.logger.warn('SMS service is not enabled, skipping bulk SMS send');
      return { success: 0, failed: phoneNumbers.length };
    }

    let success = 0;
    let failed = 0;

    // إرسال الرسائل بشكل متوازي (مع حد أقصى 10 في نفس الوقت)
    const batchSize = 10;
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(phone => this.sendSms(phone, message))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
        }
      });
    }

    this.logger.log(`Bulk SMS completed: ${success} sent, ${failed} failed`);
    return { success, failed };
  }

  /**
   * تنظيف رقم الهاتف
   */
  private cleanPhoneNumber(phone: string): string {
    // إزالة المسافات والرموز الخاصة
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // إضافة رمز الدولة إذا لم يكن موجوداً (افتراض +966 للسعودية)
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0')) {
        cleaned = '+966' + cleaned.substring(1);
      } else if (cleaned.startsWith('966')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+966' + cleaned;
      }
    }

    return cleaned;
  }

  /**
   * التحقق من حالة الخدمة
   */
  isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}

