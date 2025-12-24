import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export interface DataSyncEvent {
  type: 'create' | 'update' | 'delete';
  entity: string; // 'salon', 'package', 'subscription', 'visit', 'review', 'payment', 'customer', 'user'
  data: any;
  userId?: number; // المستخدم الذي قام بالتغيير
  affectedUserIds?: number[]; // المستخدمين المتأثرين بالتغيير
}

@Injectable()
export class DataSyncService {
  private server: Server;
  private readonly logger = new Logger(DataSyncService.name);

  /**
   * تعيين server instance
   */
  setServer(server: Server) {
    this.server = server;
    this.logger.log('DataSync service initialized with server');
  }

  /**
   * إرسال حدث مزامنة لمستخدم محدد
   */
  async syncToUser(userId: number, event: DataSyncEvent) {
    try {
      const room = `data-sync:${userId}`;
      
      this.server.to(room).emit('data:sync', {
        ...event,
        timestamp: new Date(),
      });

      this.logger.log(`Data sync sent to user ${userId}: ${event.entity} ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to sync data to user: ${error.message}`, error.stack);
    }
  }

  /**
   * إرسال حدث مزامنة لمجموعة مستخدمين
   */
  async syncToUsers(userIds: number[], event: DataSyncEvent) {
    try {
      for (const userId of userIds) {
        await this.syncToUser(userId, event);
      }

      this.logger.log(`Data sync sent to ${userIds.length} users: ${event.entity} ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to sync data to users: ${error.message}`, error.stack);
    }
  }

  /**
   * إرسال حدث مزامنة لجميع المستخدمين (broadcast)
   */
  async broadcastSync(event: DataSyncEvent) {
    try {
      this.server.emit('data:sync', {
        ...event,
        timestamp: new Date(),
      });

      this.logger.log(`Broadcast data sync: ${event.entity} ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast data sync: ${error.message}`, error.stack);
    }
  }

  /**
   * إرسال حدث مزامنة حسب الدور
   */
  async syncToRole(role: 'ADMIN' | 'SALON_OWNER' | 'CUSTOMER', event: DataSyncEvent) {
    try {
      const room = `data-sync:role:${role}`;
      
      this.server.to(room).emit('data:sync', {
        ...event,
        timestamp: new Date(),
      });

      this.logger.log(`Data sync sent to role ${role}: ${event.entity} ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to sync data to role: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper methods for common entities
   */
  async syncSalon(salonId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    await this.broadcastSync({
      type,
      entity: 'salon',
      data: { id: salonId, ...data },
      affectedUserIds,
    });
  }

  async syncPackage(packageId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    await this.broadcastSync({
      type,
      entity: 'package',
      data: { id: packageId, ...data },
      affectedUserIds,
    });
  }

  async syncSubscription(subscriptionId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    if (affectedUserIds && affectedUserIds.length > 0) {
      await this.syncToUsers(affectedUserIds, {
        type,
        entity: 'subscription',
        data: { id: subscriptionId, ...data },
        affectedUserIds,
      });
    } else {
      await this.broadcastSync({
        type,
        entity: 'subscription',
        data: { id: subscriptionId, ...data },
        affectedUserIds,
      });
    }
  }

  async syncVisit(visitId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    if (affectedUserIds && affectedUserIds.length > 0) {
      await this.syncToUsers(affectedUserIds, {
        type,
        entity: 'visit',
        data: { id: visitId, ...data },
        affectedUserIds,
      });
    } else {
      await this.broadcastSync({
        type,
        entity: 'visit',
        data: { id: visitId, ...data },
        affectedUserIds,
      });
    }
  }

  async syncReview(reviewId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    await this.broadcastSync({
      type,
      entity: 'review',
      data: { id: reviewId, ...data },
      affectedUserIds,
    });
  }

  async syncPayment(paymentId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    if (affectedUserIds && affectedUserIds.length > 0) {
      await this.syncToUsers(affectedUserIds, {
        type,
        entity: 'payment',
        data: { id: paymentId, ...data },
        affectedUserIds,
      });
    } else {
      await this.syncToRole('ADMIN', {
        type,
        entity: 'payment',
        data: { id: paymentId, ...data },
        affectedUserIds,
      });
    }
  }

  async syncCustomer(customerId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    await this.broadcastSync({
      type,
      entity: 'customer',
      data: { id: customerId, ...data },
      affectedUserIds,
    });
  }

  async syncUser(userId: number, type: 'create' | 'update' | 'delete', data: any, affectedUserIds?: number[]) {
    await this.syncToRole('ADMIN', {
      type,
      entity: 'user',
      data: { id: userId, ...data },
      affectedUserIds,
    });
  }
}

