import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    PrismaModule,
    SubscriptionsModule,
    ReviewsModule,
    NotificationsModule,
    SecurityModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
