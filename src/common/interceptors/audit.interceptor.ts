import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: user.userId,
              action: request.method,
              resource: this.extractResource(request.url),
              resourceId: this.extractResourceId(request.params),
              details: {
                url: request.url,
                method: request.method,
                userAgent: request.headers['user-agent'],
                ipAddress: request.ip,
              },
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            },
          });
        } catch (error) {
          // Log error but don't fail the request
          console.error('Audit logging failed:', error);
        }
      }),
    );
  }

  private extractResource(url: string): string {
    const segments = url.split('/').filter(segment => segment);
    return segments[0] || 'unknown';
  }

  private extractResourceId(params: any): number | null {
    const idParam = params.id || params.salonId || params.customerId || params.packageId;
    return idParam ? parseInt(idParam, 10) : null;
  }
}
