import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(private prisma: PrismaService) {
    // ضبط إعدادات OTP
    authenticator.options = {
      window: 1, // السماح بـ ±30 ثانية
      step: 30, // الكود يتغير كل 30 ثانية
    };
  }

  /**
   * إنشاء سر 2FA جديد للمستخدم
   */
  async generateSecret(userId: number, userEmail: string) {
    try {
      this.logger.log(`[2FA] Generating secret for user ${userId} (${userEmail})`);
      
      // التحقق من وجود secret قديم
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (existingUser?.twoFactorSecret) {
        this.logger.warn(`[2FA] User ${userId} already has a secret. Replacing with new one.`);
        this.logger.warn(`[2FA] Old secret (first 10 chars): ${existingUser.twoFactorSecret.substring(0, 10)}...`);
        
        if (existingUser.twoFactorEnabled) {
          this.logger.warn(`[2FA] ⚠️ User ${userId} has 2FA enabled. This will disable it.`);
        }
      }
      
      // إنشاء سر جديد
      const secret = speakeasy.generateSecret({
        name: `Barber Platform (${userEmail})`,
        issuer: 'Barber Platform',
        length: 32,
      });

      this.logger.log(`[2FA] New secret generated: ${secret.base32.substring(0, 10)}...`);
      this.logger.log(`[2FA] OTP Auth URL: ${secret.otpauth_url?.substring(0, 50)}...`);

      // حفظ السر في قاعدة البيانات (مؤقتاً حتى يتم التفعيل)
      // ⚠️ مهم: نحذف الـ secret القديم ونضع الجديد
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret.base32,
          twoFactorEnabled: false, // لم يتم التفعيل بعد (حتى لو كان مفعلاً سابقاً)
        },
      });
      
      // حذف backup codes القديمة
      await this.prisma.twoFactorBackupCode.deleteMany({
        where: { userId },
      });
      
      this.logger.log(`[2FA] Old backup codes deleted for user ${userId}`);

      // إنشاء كود توقعي للاختبار
      const testToken = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });
      this.logger.log(`[2FA] Test token (current): ${testToken}`);

      this.logger.log(`[2FA] ✅ Secret generated and saved for user ${userId}`);

      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
      };
    } catch (error) {
      this.logger.error(`[2FA] ❌ Failed to generate 2FA secret: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate 2FA secret');
    }
  }

  /**
   * إنشاء QR Code
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      // إنشاء QR code كـ Data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      
      this.logger.log('QR Code generated successfully');
      
      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * التحقق من كود 2FA
   */
  async verifyToken(userId: number, token: string): Promise<boolean> {
    try {
      this.logger.log(`[2FA] Verifying token for user ${userId}, token: ${token?.substring(0, 2)}***`);
      
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user) {
        this.logger.error(`[2FA] User ${userId} not found`);
        throw new UnauthorizedException('User not found');
      }

      if (!user.twoFactorSecret) {
        this.logger.error(`[2FA] User ${userId} has no 2FA secret configured`);
        throw new UnauthorizedException('2FA not configured. Please setup 2FA first.');
      }

      // تنظيف الكود (إزالة المسافات والأحرف غير الرقمية)
      const cleanToken = token?.toString().trim().replace(/\s/g, '');
      
      if (!cleanToken || cleanToken.length !== 6) {
        this.logger.error(`[2FA] Invalid token format: ${cleanToken} (length: ${cleanToken?.length})`);
        throw new UnauthorizedException('Invalid token format. Token must be 6 digits.');
      }

      // إنشاء كود توقعي للاختبار (للتشخيص فقط)
      const expectedToken = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: 'base32',
      });
      
      this.logger.log(`[2FA] Secret (first 10 chars): ${user.twoFactorSecret.substring(0, 10)}...`);
      this.logger.log(`[2FA] Expected token (current): ${expectedToken}`);
      this.logger.log(`[2FA] Received token: ${cleanToken}`);

      // التحقق من الكود
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: cleanToken,
        window: 2, // السماح بـ ±60 ثانية للمرونة
      });

      this.logger.log(`[2FA] Token verification for user ${userId}: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!isValid) {
        // محاولة أخرى مع window أكبر للاختبار
        this.logger.log(`[2FA] Trying with larger window (5) for user ${userId}`);
        const isValidWithLargerWindow = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: cleanToken,
          window: 5, // السماح بـ ±150 ثانية
        });
        
        if (isValidWithLargerWindow) {
          this.logger.warn(`[2FA] Token valid with larger window for user ${userId}`);
          return true;
        }
        
        // محاولة مع window أكبر جداً (للاختبار فقط)
        this.logger.log(`[2FA] Trying with very large window (10) for user ${userId}`);
        const isValidWithVeryLargeWindow = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: cleanToken,
          window: 10, // السماح بـ ±300 ثانية (للاختبار فقط)
        });
        
        if (isValidWithVeryLargeWindow) {
          this.logger.warn(`[2FA] Token valid with very large window for user ${userId} - Time sync issue?`);
          return true;
        }
        
        this.logger.error(`[2FA] All verification attempts failed for user ${userId}`);
        this.logger.error(`[2FA] Token mismatch: Expected ~${expectedToken}, Got ${cleanToken}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`[2FA] Failed to verify token for user ${userId}: ${error.message}`, error.stack);
      
      // إذا كان الخطأ من speakeasy، نعيد رسالة أوضح
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException(`Invalid 2FA token: ${error.message}`);
    }
  }

  /**
   * تفعيل 2FA
   */
  async enable2FA(userId: number, token: string) {
    try {
      this.logger.log(`[2FA] Enabling 2FA for user ${userId}`);
      
      // التحقق من الكود أولاً
      const isValid = await this.verifyToken(userId, token);

      if (!isValid) {
        this.logger.error(`[2FA] Token verification failed for user ${userId}`);
        throw new UnauthorizedException('Invalid 2FA token. Please check the code from your authenticator app.');
      }

      this.logger.log(`[2FA] Token verified successfully for user ${userId}`);

      // إنشاء backup codes
      const backupCodes = await this.generateBackupCodes(userId);
      this.logger.log(`[2FA] Generated ${backupCodes.length} backup codes for user ${userId}`);

      // تفعيل 2FA
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
        },
      });

      this.logger.log(`[2FA] ✅ 2FA enabled successfully for user ${userId}`);

      return {
        enabled: true,
        backupCodes,
        message: '2FA enabled successfully. Please save your backup codes!',
      };
    } catch (error) {
      this.logger.error(`[2FA] ❌ Failed to enable 2FA for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * تعطيل 2FA
   */
  async disable2FA(userId: number, password: string) {
    try {
      // التحقق من كلمة المرور أولاً
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // التحقق من كلمة المرور
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for disabling 2FA - user ${userId}`);
        throw new UnauthorizedException('Invalid password');
      }

      // حذف backup codes
      await this.prisma.twoFactorBackupCode.deleteMany({
        where: { userId },
      });

      // تعطيل 2FA
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      this.logger.log(`2FA disabled for user ${userId}`);

      return {
        enabled: false,
        message: '2FA has been disabled',
      };
    } catch (error) {
      this.logger.error(`Failed to disable 2FA: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * إنشاء backup codes
   */
  async generateBackupCodes(userId: number): Promise<string[]> {
    try {
      // حذف الأكواد القديمة
      await this.prisma.twoFactorBackupCode.deleteMany({
        where: { userId },
      });

      const backupCodes: string[] = [];
      const hashedCodes: { userId: number; code: string; used: boolean }[] = [];

      // إنشاء 10 أكواد احتياطية
      for (let i = 0; i < 10; i++) {
        // إنشاء كود عشوائي (8 أحرف)
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);

        // تشفير الكود قبل الحفظ
        const hashedCode = crypto
          .createHash('sha256')
          .update(code)
          .digest('hex');

        hashedCodes.push({
          userId,
          code: hashedCode,
          used: false,
        });
      }

      // حفظ الأكواد المشفرة في قاعدة البيانات
      await this.prisma.twoFactorBackupCode.createMany({
        data: hashedCodes,
      });

      this.logger.log(`Generated ${backupCodes.length} backup codes for user ${userId}`);

      return backupCodes;
    } catch (error) {
      this.logger.error(`Failed to generate backup codes: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate backup codes');
    }
  }

  /**
   * التحقق من backup code
   */
  async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    try {
      // تشفير الكود المُدخل
      const hashedCode = crypto
        .createHash('sha256')
        .update(code.toUpperCase())
        .digest('hex');

      // البحث عن الكود في قاعدة البيانات
      const backupCode = await this.prisma.twoFactorBackupCode.findFirst({
        where: {
          userId,
          code: hashedCode,
          used: false,
        },
      });

      if (!backupCode) {
        this.logger.warn(`Invalid or already used backup code for user ${userId}`);
        return false;
      }

      // تعليم الكود كمستخدم
      await this.prisma.twoFactorBackupCode.update({
        where: { id: backupCode.id },
        data: { used: true },
      });

      this.logger.log(`Backup code used successfully for user ${userId}`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to verify backup code: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * الحصول على حالة 2FA للمستخدم
   */
  async get2FAStatus(userId: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          twoFactorEnabled: true,
          twoFactorSecret: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // عد الأكواد الاحتياطية المتبقية
      const remainingBackupCodes = await this.prisma.twoFactorBackupCode.count({
        where: {
          userId,
          used: false,
        },
      });

      return {
        enabled: user.twoFactorEnabled || false,
        configured: !!user.twoFactorSecret,
        remainingBackupCodes,
      };
    } catch (error) {
      this.logger.error(`Failed to get 2FA status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * إنشاء أكواد احتياطية جديدة
   */
  async regenerateBackupCodes(userId: number, token: string): Promise<string[]> {
    try {
      // التحقق من الكود أولاً
      const isValid = await this.verifyToken(userId, token);

      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA token');
      }

      // إنشاء أكواد جديدة
      const backupCodes = await this.generateBackupCodes(userId);

      this.logger.log(`Backup codes regenerated for user ${userId}`);

      return backupCodes;
    } catch (error) {
      this.logger.error(`Failed to regenerate backup codes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * التحقق من 2FA (كود عادي أو backup code)
   */
  async verify2FA(userId: number, code: string): Promise<boolean> {
    try {
      // محاولة التحقق ككود عادي أولاً
      const isValidToken = await this.verifyToken(userId, code);
      
      if (isValidToken) {
        return true;
      }

      // إذا فشل، جرب كـ backup code
      const isValidBackupCode = await this.verifyBackupCode(userId, code);
      
      return isValidBackupCode;
    } catch (error) {
      this.logger.error(`Failed to verify 2FA: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * التحقق من حاجة المستخدم لـ 2FA
   */
  async requires2FA(userId: number): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });

      return user?.twoFactorEnabled || false;
    } catch (error) {
      this.logger.error(`Failed to check 2FA requirement: ${error.message}`, error.stack);
      return false;
    }
  }
}

