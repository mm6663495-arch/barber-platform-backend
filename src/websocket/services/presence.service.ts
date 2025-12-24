import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

interface UserPresence {
  userId: number;
  socketIds: Set<string>;
  lastSeen: Date;
  status: 'online' | 'offline' | 'away';
}

@Injectable()
export class PresenceService {
  private server: Server;
  private readonly logger = new Logger(PresenceService.name);
  
  // تخزين حالة المستخدمين في الذاكرة
  // في الإنتاج، استخدم Redis للتوسع
  private userPresence: Map<number, UserPresence> = new Map();

  /**
   * تعيين server instance
   */
  setServer(server: Server) {
    this.server = server;
    this.logger.log('Presence service initialized with server');
  }

  /**
   * تسجيل المستخدم كـ online
   */
  async setOnline(userId: number, socketId: string) {
    try {
      const presence = this.userPresence.get(userId) || {
        userId,
        socketIds: new Set(),
        lastSeen: new Date(),
        status: 'online',
      };

      presence.socketIds.add(socketId);
      presence.status = 'online';
      presence.lastSeen = new Date();

      this.userPresence.set(userId, presence);

      this.logger.log(`User ${userId} is now online (socket: ${socketId})`);

      // إشعار الآخرين
      this.broadcastPresenceUpdate(userId, 'online');
    } catch (error) {
      this.logger.error(`Failed to set user online: ${error.message}`);
    }
  }

  /**
   * تسجيل المستخدم كـ offline
   */
  async setOffline(userId: number, socketId: string) {
    try {
      const presence = this.userPresence.get(userId);

      if (!presence) {
        return;
      }

      presence.socketIds.delete(socketId);

      // إذا لم يعد لديه أي اتصالات، اعتبره offline
      if (presence.socketIds.size === 0) {
        presence.status = 'offline';
        presence.lastSeen = new Date();

        this.logger.log(`User ${userId} is now offline`);

        // إشعار الآخرين
        this.broadcastPresenceUpdate(userId, 'offline');
      }

      this.userPresence.set(userId, presence);
    } catch (error) {
      this.logger.error(`Failed to set user offline: ${error.message}`);
    }
  }

  /**
   * تعيين حالة المستخدم كـ away
   */
  async setAway(userId: number) {
    try {
      const presence = this.userPresence.get(userId);

      if (!presence || presence.status === 'offline') {
        return;
      }

      presence.status = 'away';
      presence.lastSeen = new Date();

      this.userPresence.set(userId, presence);

      this.logger.log(`User ${userId} is now away`);

      // إشعار الآخرين
      this.broadcastPresenceUpdate(userId, 'away');
    } catch (error) {
      this.logger.error(`Failed to set user away: ${error.message}`);
    }
  }

  /**
   * التحقق من كون المستخدم online
   */
  async isUserOnline(userId: number): Promise<boolean> {
    const presence = this.userPresence.get(userId);
    return presence?.status === 'online' || false;
  }

  /**
   * الحصول على آخر ظهور للمستخدم
   */
  async getLastSeen(userId: number): Promise<Date | null> {
    const presence = this.userPresence.get(userId);
    return presence?.lastSeen || null;
  }

  /**
   * الحصول على حالة المستخدم
   */
  async getUserStatus(userId: number): Promise<'online' | 'offline' | 'away'> {
    const presence = this.userPresence.get(userId);
    return presence?.status || 'offline';
  }

  /**
   * الحصول على جميع المستخدمين المتصلين
   */
  async getOnlineUsers(): Promise<number[]> {
    const onlineUsers: number[] = [];

    this.userPresence.forEach((presence, userId) => {
      if (presence.status === 'online') {
        onlineUsers.push(userId);
      }
    });

    return onlineUsers;
  }

  /**
   * الحصول على عدد المستخدمين المتصلين
   */
  async getOnlineCount(): Promise<number> {
    let count = 0;

    this.userPresence.forEach((presence) => {
      if (presence.status === 'online') {
        count++;
      }
    });

    return count;
  }

  /**
   * إشعار الآخرين بتحديث حالة المستخدم
   */
  private broadcastPresenceUpdate(
    userId: number,
    status: 'online' | 'offline' | 'away',
  ) {
    if (!this.server) {
      return;
    }

    this.server.emit('presence:update', {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * الحصول على معلومات presence متعددة
   */
  async getBulkPresence(userIds: number[]): Promise<
    Array<{
      userId: number;
      status: 'online' | 'offline' | 'away';
      lastSeen: Date | null;
    }>
  > {
    return userIds.map(userId => ({
      userId,
      status: this.userPresence.get(userId)?.status || 'offline',
      lastSeen: this.userPresence.get(userId)?.lastSeen || null,
    }));
  }

  /**
   * تنظيف البيانات القديمة
   * يجب استدعاؤه بشكل دوري (cron job)
   */
  async cleanup() {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 دقيقة

    this.userPresence.forEach((presence, userId) => {
      if (presence.status === 'offline') {
        const timeSinceLastSeen = now.getTime() - presence.lastSeen.getTime();
        
        if (timeSinceLastSeen > timeout) {
          this.userPresence.delete(userId);
          this.logger.log(`Cleaned up presence data for user ${userId}`);
        }
      }
    });
  }

  /**
   * الحصول على إحصائيات
   */
  async getStats() {
    const total = this.userPresence.size;
    let online = 0;
    let away = 0;
    let offline = 0;

    this.userPresence.forEach((presence) => {
      switch (presence.status) {
        case 'online':
          online++;
          break;
        case 'away':
          away++;
          break;
        case 'offline':
          offline++;
          break;
      }
    });

    return {
      total,
      online,
      away,
      offline,
    };
  }
}

