import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TwoFactorService } from '../two-factor.service';

/**
 * Guard للتحقق من 2FA
 * يتم استخدامه على المسارات التي تتطلب 2FA
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  private readonly logger = new Logger(TwoFactorGuard.name);

  constructor(
    private reflector: Reflector,
    private twoFactorService: TwoFactorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // التحقق من تفعيل 2FA للمستخدم
    const requires2FA = await this.twoFactorService.requires2FA(user.id);

    if (!requires2FA) {
      // المستخدم لم يفعل 2FA، السماح بالمرور
      return true;
    }

    // التحقق من وجود 2FA token في الـ request
    const twoFactorVerified = request.headers['x-2fa-verified'] === 'true';
    
    if (!twoFactorVerified) {
      this.logger.warn(`2FA verification required for user ${user.id}`);
      throw new UnauthorizedException('2FA verification required');
    }

    return true;
  }
}

/**
 * Decorator لتطبيق 2FA Guard
 */
export const Require2FA = () => {
  // يمكن استخدامه لاحقاً لتخصيص السلوك
  return () => {};
};

