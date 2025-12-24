import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { NotificationService } from './services/notification.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';
import { DataSyncService } from './services/data-sync.service';

@WebSocketGateway({
  cors: {
    origin: '*', // في الإنتاج، حدد النطاقات المسموحة
    credentials: true,
  },
  namespace: '/ws',
})
export class WebSocketGatewayHandler
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGatewayHandler.name);

  constructor(
    private notificationService: NotificationService,
    private presenceService: PresenceService,
    private typingService: TypingService,
    private dataSyncService: DataSyncService,
    private jwtService: JwtService,
  ) {}

  /**
   * يتم تنفيذه عند تهيئة Gateway
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.notificationService.setServer(server);
    this.presenceService.setServer(server);
    this.typingService.setServer(server);
    this.dataSyncService.setServer(server);
  }

  /**
   * يتم تنفيذه عند اتصال عميل جديد
   */
  async handleConnection(client: Socket) {
    try {
      // استخراج user من token
      const token = client.handshake.auth.token || client.handshake.headers.authorization;
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // التحقق من الـ token وحفظ معلومات المستخدم
      const user = await this.validateToken(token);
      
      if (!user) {
        this.logger.warn(`Client ${client.id} has invalid token`);
        client.disconnect();
        return;
      }

      // حفظ معلومات المستخدم في socket
      client.data.user = user;

      // تسجيل المستخدم كـ online
      await this.presenceService.setOnline(user.id, client.id);

      this.logger.log(`Client connected: ${client.id} (User: ${user.id})`);

      // إرسال رسالة ترحيب
      client.emit('connected', {
        message: 'Connected to WebSocket server',
        userId: user.id,
      });

      // إشعار الآخرين بأن المستخدم online
      client.broadcast.emit('user:online', {
        userId: user.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  /**
   * يتم تنفيذه عند فصل عميل
   */
  async handleDisconnect(client: Socket) {
    try {
      const user = client.data.user;

      if (user) {
        // تسجيل المستخدم كـ offline
        await this.presenceService.setOffline(user.id, client.id);

        this.logger.log(`Client disconnected: ${client.id} (User: ${user.id})`);

        // إشعار الآخرين بأن المستخدم offline
        client.broadcast.emit('user:offline', {
          userId: user.id,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`, error.stack);
    }
  }

  /**
   * الاشتراك في الإشعارات
   */
  @SubscribeMessage('notifications:subscribe')
  @UseGuards(WsJwtGuard)
  handleSubscribeNotifications(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.id;
    const room = `notifications:${userId}`;
    
    client.join(room);
    this.logger.log(`User ${userId} subscribed to notifications`);
    
    return { event: 'notifications:subscribed', data: { room } };
  }

  /**
   * إلغاء الاشتراك في الإشعارات
   */
  @SubscribeMessage('notifications:unsubscribe')
  @UseGuards(WsJwtGuard)
  handleUnsubscribeNotifications(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.id;
    const room = `notifications:${userId}`;
    
    client.leave(room);
    this.logger.log(`User ${userId} unsubscribed from notifications`);
    
    return { event: 'notifications:unsubscribed', data: { room } };
  }

  /**
   * الاشتراك في مزامنة البيانات
   */
  @SubscribeMessage('data-sync:subscribe')
  @UseGuards(WsJwtGuard)
  handleSubscribeDataSync(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.id;
    const userRole = client.data.user.role;
    
    // الانضمام إلى room المستخدم
    const userRoom = `data-sync:${userId}`;
    client.join(userRoom);
    
    // الانضمام إلى room الدور
    const roleRoom = `data-sync:role:${userRole}`;
    client.join(roleRoom);
    
    this.logger.log(`User ${userId} (${userRole}) subscribed to data sync`);
    
    return { 
      event: 'data-sync:subscribed', 
      data: { 
        userRoom,
        roleRoom,
      } 
    };
  }

  /**
   * إلغاء الاشتراك في مزامنة البيانات
   */
  @SubscribeMessage('data-sync:unsubscribe')
  @UseGuards(WsJwtGuard)
  handleUnsubscribeDataSync(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.id;
    const userRole = client.data.user.role;
    
    // مغادرة room المستخدم
    const userRoom = `data-sync:${userId}`;
    client.leave(userRoom);
    
    // مغادرة room الدور
    const roleRoom = `data-sync:role:${userRole}`;
    client.leave(roleRoom);
    
    this.logger.log(`User ${userId} (${userRole}) unsubscribed from data sync`);
    
    return { 
      event: 'data-sync:unsubscribed', 
      data: { 
        userRoom,
        roleRoom,
      } 
    };
  }

  /**
   * إرسال إشعار
   */
  @SubscribeMessage('notification:send')
  @UseGuards(WsJwtGuard)
  async handleSendNotification(
    @MessageBody() data: { targetUserId: number; type: string; message: string; data?: any },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.user.id;
    
    await this.notificationService.sendNotification(
      data.targetUserId,
      {
        type: data.type,
        message: data.message,
        data: data.data,
        senderId,
      },
    );

    return { event: 'notification:sent', data: { success: true } };
  }

  /**
   * الانضمام إلى محادثة
   */
  @SubscribeMessage('chat:join')
  @UseGuards(WsJwtGuard)
  handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `chat:${data.chatId}`;
    client.join(room);
    
    this.logger.log(`User ${client.data.user.id} joined chat ${data.chatId}`);
    
    // إشعار الآخرين في المحادثة
    client.to(room).emit('chat:user-joined', {
      userId: client.data.user.id,
      chatId: data.chatId,
      timestamp: new Date(),
    });

    return { event: 'chat:joined', data: { chatId: data.chatId } };
  }

  /**
   * مغادرة محادثة
   */
  @SubscribeMessage('chat:leave')
  @UseGuards(WsJwtGuard)
  handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `chat:${data.chatId}`;
    client.leave(room);
    
    this.logger.log(`User ${client.data.user.id} left chat ${data.chatId}`);
    
    // إشعار الآخرين في المحادثة
    client.to(room).emit('chat:user-left', {
      userId: client.data.user.id,
      chatId: data.chatId,
      timestamp: new Date(),
    });

    return { event: 'chat:left', data: { chatId: data.chatId } };
  }

  /**
   * بدء الكتابة
   */
  @SubscribeMessage('typing:start')
  @UseGuards(WsJwtGuard)
  handleTypingStart(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.id;
    
    this.typingService.startTyping(userId, data.chatId);
    
    // إشعار الآخرين في المحادثة
    const room = `chat:${data.chatId}`;
    client.to(room).emit('typing:started', {
      userId,
      chatId: data.chatId,
      timestamp: new Date(),
    });

    return { event: 'typing:acknowledged', data: { chatId: data.chatId } };
  }

  /**
   * إيقاف الكتابة
   */
  @SubscribeMessage('typing:stop')
  @UseGuards(WsJwtGuard)
  handleTypingStop(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.id;
    
    this.typingService.stopTyping(userId, data.chatId);
    
    // إشعار الآخرين في المحادثة
    const room = `chat:${data.chatId}`;
    client.to(room).emit('typing:stopped', {
      userId,
      chatId: data.chatId,
      timestamp: new Date(),
    });

    return { event: 'typing:acknowledged', data: { chatId: data.chatId } };
  }

  /**
   * الحصول على حالة المستخدم
   */
  @SubscribeMessage('presence:get')
  @UseGuards(WsJwtGuard)
  async handleGetPresence(
    @MessageBody() data: { userId: number },
  ) {
    const isOnline = await this.presenceService.isUserOnline(data.userId);
    const lastSeen = await this.presenceService.getLastSeen(data.userId);

    return {
      event: 'presence:status',
      data: {
        userId: data.userId,
        isOnline,
        lastSeen,
      },
    };
  }

  /**
   * الحصول على المستخدمين المتصلين
   */
  @SubscribeMessage('presence:online-users')
  @UseGuards(WsJwtGuard)
  async handleGetOnlineUsers() {
    const onlineUsers = await this.presenceService.getOnlineUsers();

    return {
      event: 'presence:online-users-list',
      data: { users: onlineUsers },
    };
  }

  /**
   * التحقق من صحة الـ token
   */
  private async validateToken(token: string): Promise<any> {
    try {
      // إزالة Bearer إذا وجد
      let cleanToken = token;
      if (token.startsWith('Bearer ')) {
        cleanToken = token.substring(7);
      }
      
      // ⭐ استخدام JwtService للتحقق من الـ token
      const payload = await this.jwtService.verifyAsync(cleanToken, {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      });
      
      // إرجاع معلومات المستخدم
      return {
        id: payload.sub || payload.userId || payload.id,
        email: payload.email,
        role: payload.role,
      };
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null;
    }
  }
}

