import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // التحقق من وجود user في socket data (تم التحقق منه عند الاتصال)
      if (client.data.user) {
        return true;
      }

      // إذا لم يكن موجود، نحاول التحقق من الـ token
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Unauthorized: No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      });

      // حفظ معلومات المستخدم في socket
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch (error) {
      this.logger.error(`WS Auth error: ${error.message}`);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | null {
    // محاولة الحصول على الـ token من auth
    let token = client.handshake.auth.token;

    // محاولة الحصول على الـ token من headers
    if (!token) {
      token = client.handshake.headers.authorization;
    }

    // محاولة الحصول على الـ token من query
    if (!token) {
      token = client.handshake.query.token as string;
    }

    if (token && token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    return token || null;
  }
}

