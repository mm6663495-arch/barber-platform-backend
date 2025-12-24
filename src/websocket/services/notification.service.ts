import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationPayload {
  type: string;
  title?: string; // ⭐ إضافة title
  message: string;
  data?: any;
  senderId?: number;
}

@Injectable()
export class NotificationService {
  private server: Server;
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * تعيين server instance
   */
  setServer(server: Server) {
    this.server = server;
    this.logger.log('Notification service initialized with server');
  }

  /**
   * إرسال إشعار لمستخدم محدد
   */
  async sendNotification(userId: number, payload: NotificationPayload) {
    try {
      // حفظ الإشعار في قاعدة البيانات
      const notification = await this.createNotification(userId, payload);

      // إرسال الإشعار عبر WebSocket
      const room = `notifications:${userId}`;
      
      this.server.to(room).emit('notification:new', {
        id: notification.id,
        type: payload.type,
        title: payload.title || this.getNotificationTitle(payload.type),
        message: payload.message,
        data: payload.data,
        senderId: payload.senderId,
        read: false,
        isRead: false,
        createdAt: notification.createdAt,
      });

      this.logger.log(`Notification sent to user ${userId}: ${payload.type}`);

      return notification;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * إرسال إشعار لمجموعة مستخدمين
   */
  async sendBulkNotifications(userIds: number[], payload: NotificationPayload) {
    try {
      const notifications = await Promise.all(
        userIds.map(userId => this.sendNotification(userId, payload)),
      );

      this.logger.log(`Bulk notifications sent to ${userIds.length} users`);

      return notifications;
    } catch (error) {
      this.logger.error(`Failed to send bulk notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * إرسال إشعار broadcast لجميع المستخدمين
   */
  async broadcastNotification(payload: NotificationPayload) {
    try {
      this.server.emit('notification:broadcast', {
        type: payload.type,
        message: payload.message,
        data: payload.data,
        timestamp: new Date(),
      });

      this.logger.log(`Broadcast notification sent: ${payload.type}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * تعليم إشعار كمقروء
   */
  async markAsRead(userId: number, notificationId: number) {
    try {
      const notification = await this.prisma.notification.update({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });

      // إشعار المستخدم بأن الإشعار تم قراءته
      const room = `notifications:${userId}`;
      this.server.to(room).emit('notification:read', {
        notificationId,
        timestamp: new Date(),
      });

      return notification;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * تعليم جميع الإشعارات كمقروءة
   */
  async markAllAsRead(userId: number) {
    try {
      await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      // إشعار المستخدم
      const room = `notifications:${userId}`;
      this.server.to(room).emit('notifications:all-read', {
        timestamp: new Date(),
      });

      this.logger.log(`All notifications marked as read for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * حذف إشعار
   */
  async deleteNotification(userId: number, notificationId: number) {
    try {
      await this.prisma.notification.delete({
        where: { id: notificationId, userId },
      });

      // إشعار المستخدم
      const room = `notifications:${userId}`;
      this.server.to(room).emit('notification:deleted', {
        notificationId,
        timestamp: new Date(),
      });

      this.logger.log(`Notification ${notificationId} deleted for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * الحصول على عدد الإشعارات غير المقروءة
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: { userId, isRead: false },
      });
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`);
      return 0;
    }
  }

  /**
   * إنشاء إشعار في قاعدة البيانات
   */
  private async createNotification(userId: number, payload: NotificationPayload) {
    return await this.prisma.notification.create({
      data: {
        userId,
        type: payload.type as any, // Cast to avoid type issues
        title: this.getNotificationTitle(payload.type),
        message: payload.message,
        data: payload.data ? JSON.stringify(payload.data) : undefined,
        isRead: false,
      },
    });
  }

  /**
   * الحصول على عنوان الإشعار حسب النوع
   */
  private getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      'booking:new': 'حجز جديد',
      'booking:confirmed': 'تم تأكيد الحجز',
      'booking:cancelled': 'تم إلغاء الحجز',
      'review:new': 'تقييم جديد',
      'payment:received': 'تم استلام الدفع',
      'message:new': 'رسالة جديدة',
      'system': 'إشعار النظام',
    };

    return titles[type] || 'إشعار';
  }
}

