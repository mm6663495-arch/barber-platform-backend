import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsMonitoringService } from './services/reviews-monitoring.service';
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
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsMonitoringService, JwtAuthGuard],
  exports: [ReviewsService, ReviewsMonitoringService],
})
export class ReviewsModule {}

