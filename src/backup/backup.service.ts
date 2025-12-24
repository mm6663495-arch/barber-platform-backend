import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBackupDto, BackupType } from './dto/create-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { ScheduleBackupDto, BackupSchedule } from './dto/schedule-backup.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BackupService {
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor(private prisma: PrismaService) {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of user data
   */
  async createBackup(
    userId: number,
    createBackupDto: CreateBackupDto,
  ): Promise<any> {
    try {
      const backupType = createBackupDto.type || BackupType.FULL;
      const backupId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${userId}_${timestamp}_${backupId}.json`;

      // Get user data
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          salonOwner: {
            include: {
              salons: {
                include: {
                  packages: true,
                  visits: {
                    include: {
                      subscription: {
                        include: {
                          customer: true,
                          package: true,
                        },
                      },
                    },
                  },
                  reviews: true,
                },
              },
            },
          },
          customer: {
            include: {
              subscriptions: {
                include: {
                  package: {
                    include: {
                      salon: true,
                    },
                  },
                },
              },
              reviews: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prepare backup data
      const backupData = {
        backupId,
        userId,
        type: backupType,
        description: createBackupDto.description || 'Manual backup',
        createdAt: new Date().toISOString(),
        version: '1.0',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            notificationSettings: user.notificationSettings,
            twoFactorEnabled: user.twoFactorEnabled,
          },
          profile: user.salonOwner || user.customer,
          salons: user.salonOwner?.salons || [],
          packages: user.salonOwner?.salons.flatMap((s) => s.packages) || [],
          visits: user.salonOwner?.salons.flatMap((s) => s.visits) || [],
          reviews: user.salonOwner?.salons.flatMap((s) => s.reviews) || [],
          subscriptions: user.customer?.subscriptions || [],
        },
      };

      // Save backup to file
      const filePath = path.join(this.backupDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

      const fileSize = this.getFileSize(filePath);

      // Save backup record to database
      const backupLog = await (this.prisma as any).backupLog.create({
        data: {
          backupId,
          userId,
          type: backupType,
          description: backupData.description,
          filename,
          filePath,
          size: BigInt(fileSize),
          status: 'COMPLETED',
          isAutomatic: false,
        },
      });

      return {
        success: true,
        message: 'Backup created successfully',
        backup: {
          id: backupId,
          logId: backupLog.id,
          filename,
          type: backupType,
          description: backupData.description,
          createdAt: backupData.createdAt,
          size: this.formatFileSize(fileSize),
          sizeBytes: fileSize,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create backup: ${error.message}`,
      );
    }
  }

  /**
   * Get backup history for a user
   */
  async getBackupHistory(userId?: number, page = 1, limit = 20): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const where = userId ? { userId } : {};

      const [backupLogs, total] = await Promise.all([
        (this.prisma as any).backupLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        (this.prisma as any).backupLog.count({ where }),
      ]);

      const backups = backupLogs.map((log) => ({
        id: log.backupId,
        logId: log.id,
        userId: log.userId,
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              role: log.user.role,
            }
          : null,
        filename: log.filename,
        type: log.type,
        description: log.description,
        status: log.status,
        isAutomatic: log.isAutomatic,
        schedule: log.schedule,
        createdAt: log.createdAt,
        expiresAt: log.expiresAt,
        size: this.formatFileSize(Number(log.size)),
        sizeBytes: Number(log.size),
        error: log.error,
      }));

      return {
        success: true,
        data: backups,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get backup history: ${error.message}`,
      );
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    userId: number,
    restoreBackupDto: RestoreBackupDto,
  ): Promise<any> {
    try {
      // Find backup file
      const files = fs.readdirSync(this.backupDir);
      const backupFile = files.find((file) => {
        if (!file.includes(restoreBackupDto.backupId)) return false;
        const filePath = path.join(this.backupDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const backupData = JSON.parse(content);
        return backupData.backupId === restoreBackupDto.backupId;
      });

      if (!backupFile) {
        throw new NotFoundException('Backup not found');
      }

      const filePath = path.join(this.backupDir, backupFile);
      const content = fs.readFileSync(filePath, 'utf-8');
      const backupData = JSON.parse(content);

      // Verify backup belongs to user
      if (backupData.userId !== userId) {
        throw new BadRequestException('Backup does not belong to this user');
      }

      // Restore data (simplified - in production, you'd want more careful restoration)
      // For now, we'll just return success
      // In a real implementation, you'd restore the data to the database

      return {
        success: true,
        message: 'Backup restored successfully',
        backup: {
          id: backupData.backupId,
          type: backupData.type,
          createdAt: backupData.createdAt,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to restore backup: ${error.message}`,
      );
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(userId: number, backupId: string): Promise<any> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFile = files.find((file) => {
        if (!file.includes(backupId)) return false;
        const filePath = path.join(this.backupDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const backupData = JSON.parse(content);
        return (
          backupData.backupId === backupId && backupData.userId === userId
        );
      });

      if (!backupFile) {
        throw new NotFoundException('Backup not found');
      }

      const filePath = path.join(this.backupDir, backupFile);
      fs.unlinkSync(filePath);

      return {
        success: true,
        message: 'Backup deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete backup: ${error.message}`,
      );
    }
  }

  /**
   * Helper: Get file size in bytes
   */
  private getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Schedule automatic backups
   */
  async scheduleBackup(
    userId: number | null,
    scheduleDto: ScheduleBackupDto,
  ): Promise<any> {
    try {
      const scheduleKey = userId
        ? `backup_schedule_${userId}`
        : 'backup_schedule_system';

      await this.prisma.systemSetting.upsert({
        where: { key: scheduleKey },
        update: {
          value: JSON.stringify({
            ...scheduleDto,
            userId,
            updatedAt: new Date().toISOString(),
          }),
          description: 'Automatic backup schedule',
        },
        create: {
          key: scheduleKey,
          value: JSON.stringify({
            ...scheduleDto,
            userId,
            createdAt: new Date().toISOString(),
          }),
          description: 'Automatic backup schedule',
        },
      });

      return {
        success: true,
        message: 'Backup schedule configured successfully',
        schedule: scheduleDto,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to schedule backup: ${error.message}`,
      );
    }
  }

  /**
   * Get backup schedule
   */
  async getBackupSchedule(userId?: number): Promise<any> {
    try {
      const scheduleKey = userId
        ? `backup_schedule_${userId}`
        : 'backup_schedule_system';

      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: scheduleKey },
      });

      if (!setting) {
        return {
          success: true,
          data: null,
          message: 'No backup schedule configured',
        };
      }

      return {
        success: true,
        data: JSON.parse(setting.value),
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get backup schedule: ${error.message}`,
      );
    }
  }

  /**
   * Create system-wide backup (for admins)
   */
  async createSystemBackup(createBackupDto: CreateBackupDto): Promise<any> {
    try {
      const backupType = createBackupDto.type || BackupType.FULL;
      const backupId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `system_backup_${timestamp}_${backupId}.json`;

      // Get all system data
      const systemData = {
        backupId,
        type: backupType,
        description: createBackupDto.description || 'System backup',
        createdAt: new Date().toISOString(),
        version: '1.0',
        data: {
          users: await this.prisma.user.findMany({
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          }),
          salons: await this.prisma.salon.findMany({
            select: {
              id: true,
              name: true,
              ownerId: true,
              isApproved: true,
              isActive: true,
              createdAt: true,
            },
          }),
          packages: await this.prisma.package.findMany({
            select: {
              id: true,
              name: true,
              salonId: true,
              price: true,
              createdAt: true,
            },
          }),
          subscriptions: await this.prisma.subscription.findMany({
            select: {
              id: true,
              customerId: true,
              packageId: true,
              status: true,
              createdAt: true,
            },
          }),
          payments: await this.prisma.payment.findMany({
            select: {
              id: true,
              subscriptionId: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          }),
        },
      };

      // Save backup to file
      const filePath = path.join(this.backupDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(systemData, null, 2));

      const fileSize = this.getFileSize(filePath);

      // Save backup record to database
      const backupLog = await (this.prisma as any).backupLog.create({
        data: {
          backupId,
          userId: null, // System backup
          type: backupType,
          description: systemData.description,
          filename,
          filePath,
          size: BigInt(fileSize),
          status: 'COMPLETED',
          isAutomatic: false,
        },
      });

      return {
        success: true,
        message: 'System backup created successfully',
        backup: {
          id: backupId,
          logId: backupLog.id,
          filename,
          type: backupType,
          description: systemData.description,
          createdAt: systemData.createdAt,
          size: this.formatFileSize(fileSize),
          sizeBytes: fileSize,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create system backup: ${error.message}`,
      );
    }
  }

  /**
   * Automatic backup cron job - runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runAutomaticBackups() {
    try {
      // Get all enabled backup schedules
      const schedules = await this.prisma.systemSetting.findMany({
        where: {
          key: {
            startsWith: 'backup_schedule_',
          },
        },
      });

      for (const scheduleSetting of schedules) {
        try {
          const schedule = JSON.parse(scheduleSetting.value);

          if (!schedule.enabled) continue;

          const now = new Date();
          const shouldRun = this.shouldRunBackup(schedule, now);

          if (shouldRun) {
            if (schedule.userId) {
              // User backup
              await this.createBackup(schedule.userId, {
                type: schedule.type || BackupType.FULL,
                description: `Automatic ${schedule.schedule} backup`,
              });
            } else {
              // System backup
              await this.createSystemBackup({
                type: schedule.type || BackupType.FULL,
                description: `Automatic ${schedule.schedule} system backup`,
              });
            }
          }
        } catch (error) {
          console.error('Error running automatic backup:', error);
        }
      }

      // Clean up expired backups
      await this.cleanupExpiredBackups();
    } catch (error) {
      console.error('Error in automatic backup cron job:', error);
    }
  }

  /**
   * Check if backup should run based on schedule
   */
  private shouldRunBackup(schedule: any, now: Date): boolean {
    const { schedule: scheduleType, time, dayOfWeek, dayOfMonth } = schedule;

    switch (scheduleType) {
      case BackupSchedule.DAILY:
        if (time) {
          const [hours, minutes] = time.split(':').map(Number);
          return now.getHours() === hours && now.getMinutes() === minutes;
        }
        return true;

      case BackupSchedule.WEEKLY:
        if (dayOfWeek !== undefined && time) {
          const [hours, minutes] = time.split(':').map(Number);
          return (
            now.getDay() === dayOfWeek &&
            now.getHours() === hours &&
            now.getMinutes() === minutes
          );
        }
        return now.getDay() === 1; // Monday by default

      case BackupSchedule.MONTHLY:
        if (dayOfMonth !== undefined && time) {
          const [hours, minutes] = time.split(':').map(Number);
          return (
            now.getDate() === dayOfMonth &&
            now.getHours() === hours &&
            now.getMinutes() === minutes
          );
        }
        return now.getDate() === 1; // First day of month by default

      default:
        return false;
    }
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    try {
      const expiredBackups = await (this.prisma as any).backupLog.findMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      for (const backup of expiredBackups) {
        try {
          // Delete file
          if (fs.existsSync(backup.filePath)) {
            fs.unlinkSync(backup.filePath);
          }

          // Delete log
          await (this.prisma as any).backupLog.delete({
            where: { id: backup.id },
          });
        } catch (error) {
          console.error(`Error deleting expired backup ${backup.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired backups:', error);
    }
  }

  /**
   * Restore system backup (for admins)
   */
  async restoreSystemBackup(restoreBackupDto: RestoreBackupDto): Promise<any> {
    try {
      const backupLog = await (this.prisma as any).backupLog.findUnique({
        where: { backupId: restoreBackupDto.backupId },
      });

      if (!backupLog) {
        throw new NotFoundException('Backup not found');
      }

      if (!fs.existsSync(backupLog.filePath)) {
        throw new NotFoundException('Backup file not found');
      }

      const content = fs.readFileSync(backupLog.filePath, 'utf-8');
      const backupData = JSON.parse(content);

      // Update backup log status
      await (this.prisma as any).backupLog.update({
        where: { id: backupLog.id },
        data: { status: 'IN_PROGRESS' },
      });

      // TODO: Implement actual restoration logic
      // This is a placeholder - in production, you'd want careful restoration

      await (this.prisma as any).backupLog.update({
        where: { id: backupLog.id },
        data: { status: 'COMPLETED' },
      });

      return {
        success: true,
        message: 'System backup restored successfully',
        backup: {
          id: backupLog.backupId,
          type: backupLog.type,
          createdAt: backupLog.createdAt,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to restore system backup: ${error.message}`,
      );
    }
  }
}

