import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from './config/config.module';
import { SalonsModule } from './salons/salons.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { SecurityModule } from './security/security.module';
import { TasksModule } from './tasks/tasks.module';
import { UploadModule } from './upload/upload.module';
import { CacheModule } from './cache/cache.module';
import { StorageModule } from './storage/storage.module';
import { WebSocketModule } from './websocket/websocket.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { BackupModule } from './backup/backup.module';
import { VisitsModule } from './visits/visits.module';
import { FavoritesModule } from './favorites/favorites.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AdvancedReportsModule } from './advanced-reports/advanced-reports.module';
import { ReportsModule } from './reports/reports.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EnhancedValidationPipe } from './common/pipes/validation.pipe';
import { SecurityMiddleware, XssSanitizationMiddleware } from './common/middleware/security.middleware';
import { AdvancedRateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    CommonModule, // Global module للـ JWT و Guards
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    AuthModule,
    UsersModule,
    SalonsModule,
    SubscriptionsModule,
    PaymentsModule,
    ReviewsModule,
    NotificationsModule,
    AdminModule,
    SecurityModule,
    TasksModule,
    // UploadModule, // ⚠️ معطل - نستخدم StorageModule بدلاً منه
    CacheModule,
    StorageModule,
    WebSocketModule,
    TwoFactorModule,
    BackupModule,
    VisitsModule,
    FavoritesModule,
    PermissionsModule,
    AdvancedReportsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Guard: Rate Limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Filters: Exception Handling (Order matters!)
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter, // First: Prisma errors
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter, // Second: HTTP errors
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter, // Last: Catch-all
    },
    // Global Interceptor: Logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global Pipe: Enhanced Validation
    {
      provide: APP_PIPE,
      useClass: EnhancedValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // تطبيق Security Middleware على جميع الطلبات ما عدا static files
    consumer
      .apply(SecurityMiddleware, XssSanitizationMiddleware)
      .exclude(
        { path: 'uploads', method: RequestMethod.ALL },
        { path: 'uploads/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
