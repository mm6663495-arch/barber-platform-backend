import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { UnifiedPaymentHistoryService } from './services/unified-payment-history.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentGatewayService,
    UnifiedPaymentHistoryService,
    JwtAuthGuard,
  ],
  exports: [
    PaymentsService,
    PaymentGatewayService,
    UnifiedPaymentHistoryService,
  ],
})
export class PaymentsModule {}

