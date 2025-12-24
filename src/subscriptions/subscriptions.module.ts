import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController, VisitsController } from './subscriptions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    forwardRef(() => WebSocketModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SubscriptionsController, VisitsController],
  providers: [SubscriptionsService, JwtAuthGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
