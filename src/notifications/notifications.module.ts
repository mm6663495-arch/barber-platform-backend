import { Module, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { VisitRemindersService } from './visit-reminders.service';
import { SmsService } from './services/sms.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WebSocketModule } from '../websocket/websocket.module';
import { NotificationService as WebSocketNotificationService } from '../websocket/services/notification.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // ⭐ إضافة ScheduleModule للتذكيرات المجدولة
    WebSocketModule, // ⭐ إضافة WebSocketModule للوصول إلى WebSocket NotificationService
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, VisitRemindersService, SmsService, JwtAuthGuard],
  exports: [NotificationsService, VisitRemindersService, SmsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => WebSocketNotificationService))
    private websocketNotificationService: WebSocketNotificationService,
  ) {}

  async onModuleInit() {
    // ربط WebSocket NotificationService مع NotificationsService
    this.notificationsService.setWebSocketService(this.websocketNotificationService);
    console.log('✅ NotificationsService connected to WebSocket NotificationService');
  }
}

