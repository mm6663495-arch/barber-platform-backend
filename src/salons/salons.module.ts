import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SalonsService } from './salons.service';
import { SalonsController } from './salons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      signOptions: { expiresIn: '7d' },
    }),
    forwardRef(() => WebSocketModule),
  ],
  controllers: [SalonsController],
  providers: [SalonsService, JwtAuthGuard],
  exports: [SalonsService],
})
export class SalonsModule {}
