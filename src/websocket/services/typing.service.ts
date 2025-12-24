import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

interface TypingInfo {
  userId: number;
  chatId: string;
  startedAt: Date;
  timeout?: NodeJS.Timeout;
}

@Injectable()
export class TypingService {
  private server: Server;
  private readonly logger = new Logger(TypingService.name);
  
  // تخزين حالة الكتابة
  // key: `${userId}:${chatId}`
  private typingUsers: Map<string, TypingInfo> = new Map();
  
  // مدة timeout للكتابة (3 ثواني)
  private readonly TYPING_TIMEOUT = 3000;

  /**
   * تعيين server instance
   */
  setServer(server: Server) {
    this.server = server;
    this.logger.log('Typing service initialized with server');
  }

  /**
   * بدء الكتابة
   */
  startTyping(userId: number, chatId: string) {
    const key = this.getKey(userId, chatId);
    
    // إلغاء الـ timeout السابق إن وجد
    const existing = this.typingUsers.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    // إنشاء timeout جديد لإيقاف الكتابة تلقائياً
    const timeout = setTimeout(() => {
      this.stopTyping(userId, chatId);
    }, this.TYPING_TIMEOUT);

    // حفظ معلومات الكتابة
    this.typingUsers.set(key, {
      userId,
      chatId,
      startedAt: new Date(),
      timeout,
    });

    this.logger.debug(`User ${userId} started typing in chat ${chatId}`);
  }

  /**
   * إيقاف الكتابة
   */
  stopTyping(userId: number, chatId: string) {
    const key = this.getKey(userId, chatId);
    const typing = this.typingUsers.get(key);

    if (!typing) {
      return;
    }

    // إلغاء الـ timeout
    if (typing.timeout) {
      clearTimeout(typing.timeout);
    }

    // حذف معلومات الكتابة
    this.typingUsers.delete(key);

    this.logger.debug(`User ${userId} stopped typing in chat ${chatId}`);

    // إشعار الآخرين
    if (this.server) {
      const room = `chat:${chatId}`;
      this.server.to(room).emit('typing:stopped', {
        userId,
        chatId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * التحقق من كون المستخدم يكتب
   */
  isTyping(userId: number, chatId: string): boolean {
    const key = this.getKey(userId, chatId);
    return this.typingUsers.has(key);
  }

  /**
   * الحصول على المستخدمين الذين يكتبون في محادثة
   */
  getTypingUsers(chatId: string): number[] {
    const typingUsers: number[] = [];

    this.typingUsers.forEach((typing) => {
      if (typing.chatId === chatId) {
        typingUsers.push(typing.userId);
      }
    });

    return typingUsers;
  }

  /**
   * إيقاف جميع حالات الكتابة للمستخدم
   */
  stopAllTyping(userId: number) {
    const keysToDelete: string[] = [];

    this.typingUsers.forEach((typing, key) => {
      if (typing.userId === userId) {
        // إلغاء الـ timeout
        if (typing.timeout) {
          clearTimeout(typing.timeout);
        }
        
        // إشعار الآخرين
        if (this.server) {
          const room = `chat:${typing.chatId}`;
          this.server.to(room).emit('typing:stopped', {
            userId,
            chatId: typing.chatId,
            timestamp: new Date(),
          });
        }

        keysToDelete.push(key);
      }
    });

    // حذف جميع حالات الكتابة
    keysToDelete.forEach(key => this.typingUsers.delete(key));

    this.logger.debug(`Stopped all typing for user ${userId}`);
  }

  /**
   * تنظيف حالات الكتابة القديمة
   */
  cleanup() {
    const now = new Date();
    const keysToDelete: string[] = [];

    this.typingUsers.forEach((typing, key) => {
      const elapsed = now.getTime() - typing.startedAt.getTime();
      
      // إذا مر أكثر من 10 ثواني، اعتبرها قديمة
      if (elapsed > 10000) {
        if (typing.timeout) {
          clearTimeout(typing.timeout);
        }
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.typingUsers.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.log(`Cleaned up ${keysToDelete.length} old typing states`);
    }
  }

  /**
   * الحصول على إحصائيات
   */
  getStats() {
    const totalTyping = this.typingUsers.size;
    const chatStats: Record<string, number> = {};

    this.typingUsers.forEach((typing) => {
      chatStats[typing.chatId] = (chatStats[typing.chatId] || 0) + 1;
    });

    return {
      totalTyping,
      chatStats,
    };
  }

  /**
   * إنشاء key فريد
   */
  private getKey(userId: number, chatId: string): string {
    return `${userId}:${chatId}`;
  }
}

