import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketGatewayHandler } from './websocket.gateway';
import { NotificationService } from './services/notification.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';
import { DataSyncService } from './services/data-sync.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketController } from './websocket.controller';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [WebSocketController],
  providers: [
    WebSocketGatewayHandler,
    NotificationService,
    PresenceService,
    TypingService,
    DataSyncService,
    WsJwtGuard,
  ],
  exports: [
    NotificationService,
    PresenceService,
    TypingService,
    DataSyncService,
    WebSocketGatewayHandler,
  ],
})
export class WebSocketModule {}

