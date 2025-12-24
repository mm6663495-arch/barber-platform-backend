import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationService } from './services/notification.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';

@ApiTags('WebSocket')
@Controller('websocket')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WebSocketController {
  constructor(
    private notificationService: NotificationService,
    private presenceService: PresenceService,
    private typingService: TypingService,
  ) {}

  /**
   * إرسال إشعار لمستخدم
   */
  @Post('notifications/send')
  @ApiOperation({ summary: 'إرسال إشعار لمستخدم محدد' })
  @ApiResponse({ status: 201, description: 'تم إرسال الإشعار بنجاح' })
  async sendNotification(
    @Body()
    body: {
      targetUserId: number;
      type: string;
      message: string;
      data?: any;
    },
    @Request() req,
  ) {
    const notification = await this.notificationService.sendNotification(
      body.targetUserId,
      {
        type: body.type,
        message: body.message,
        data: body.data,
        senderId: req.user.id,
      },
    );

    return {
      success: true,
      notification,
    };
  }

  /**
   * إرسال إشعار لمجموعة مستخدمين
   */
  @Post('notifications/send-bulk')
  @ApiOperation({ summary: 'إرسال إشعار لمجموعة مستخدمين' })
  async sendBulkNotifications(
    @Body()
    body: {
      userIds: number[];
      type: string;
      message: string;
      data?: any;
    },
    @Request() req,
  ) {
    const notifications = await this.notificationService.sendBulkNotifications(
      body.userIds,
      {
        type: body.type,
        message: body.message,
        data: body.data,
        senderId: req.user.id,
      },
    );

    return {
      success: true,
      count: notifications.length,
      notifications,
    };
  }

  /**
   * إرسال إشعار broadcast
   */
  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'إرسال إشعار لجميع المستخدمين' })
  async broadcastNotification(
    @Body()
    body: {
      type: string;
      message: string;
      data?: any;
    },
  ) {
    await this.notificationService.broadcastNotification({
      type: body.type,
      message: body.message,
      data: body.data,
    });

    return {
      success: true,
      message: 'Broadcast sent successfully',
    };
  }

  /**
   * تعليم إشعار كمقروء
   */
  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'تعليم إشعار كمقروء' })
  async markNotificationAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const notification = await this.notificationService.markAsRead(
      req.user.id,
      id,
    );

    return {
      success: true,
      notification,
    };
  }

  /**
   * تعليم جميع الإشعارات كمقروءة
   */
  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllNotificationsAsRead(@Request() req) {
    await this.notificationService.markAllAsRead(req.user.id);

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  /**
   * حذف إشعار
   */
  @Delete('notifications/:id')
  @ApiOperation({ summary: 'حذف إشعار' })
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    await this.notificationService.deleteNotification(req.user.id, id);

    return {
      success: true,
      message: 'Notification deleted',
    };
  }

  /**
   * الحصول على عدد الإشعارات غير المقروءة
   */
  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'الحصول على عدد الإشعارات غير المقروءة' })
  async getUnreadCount(@Request() req) {
    const count = await this.notificationService.getUnreadCount(req.user.id);

    return {
      count,
    };
  }

  /**
   * التحقق من كون مستخدم online
   */
  @Get('presence/:userId')
  @ApiOperation({ summary: 'الحصول على حالة مستخدم' })
  async getUserPresence(@Param('userId', ParseIntPipe) userId: number) {
    const isOnline = await this.presenceService.isUserOnline(userId);
    const status = await this.presenceService.getUserStatus(userId);
    const lastSeen = await this.presenceService.getLastSeen(userId);

    return {
      userId,
      isOnline,
      status,
      lastSeen,
    };
  }

  /**
   * الحصول على جميع المستخدمين المتصلين
   */
  @Get('presence/online/users')
  @ApiOperation({ summary: 'الحصول على جميع المستخدمين المتصلين' })
  async getOnlineUsers() {
    const users = await this.presenceService.getOnlineUsers();
    const count = await this.presenceService.getOnlineCount();

    return {
      count,
      users,
    };
  }

  /**
   * الحصول على حالة مستخدمين متعددين
   */
  @Post('presence/bulk')
  @ApiOperation({ summary: 'الحصول على حالة مستخدمين متعددين' })
  async getBulkPresence(@Body() body: { userIds: number[] }) {
    const presenceData = await this.presenceService.getBulkPresence(
      body.userIds,
    );

    return {
      presence: presenceData,
    };
  }

  /**
   * تعيين حالة المستخدم كـ away
   */
  @Post('presence/away')
  @ApiOperation({ summary: 'تعيين الحالة كـ away' })
  async setAway(@Request() req) {
    await this.presenceService.setAway(req.user.id);

    return {
      success: true,
      message: 'Status set to away',
    };
  }

  /**
   * الحصول على المستخدمين الذين يكتبون في محادثة
   */
  @Get('typing/:chatId')
  @ApiOperation({ summary: 'الحصول على المستخدمين الذين يكتبون' })
  async getTypingUsers(@Param('chatId') chatId: string) {
    const users = this.typingService.getTypingUsers(chatId);

    return {
      chatId,
      typingUsers: users,
      count: users.length,
    };
  }

  /**
   * التحقق من كون مستخدم يكتب
   */
  @Get('typing/:chatId/:userId')
  @ApiOperation({ summary: 'التحقق من كون مستخدم يكتب' })
  async isUserTyping(
    @Param('chatId') chatId: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const isTyping = this.typingService.isTyping(userId, chatId);

    return {
      chatId,
      userId,
      isTyping,
    };
  }

  /**
   * الحصول على إحصائيات WebSocket
   */
  @Get('stats')
  @ApiOperation({ summary: 'الحصول على إحصائيات WebSocket' })
  async getStats() {
    const presenceStats = await this.presenceService.getStats();
    const typingStats = this.typingService.getStats();

    return {
      presence: presenceStats,
      typing: typingStats,
    };
  }
}

