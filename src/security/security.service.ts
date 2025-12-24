import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async logSecurityEvent(
    userId: number,
    event: string,
    details: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: event,
          resource: 'security',
          details: {
            event,
            ...details,
          },
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
    }
  }

  async detectSuspiciousActivity(userId: number, ipAddress: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check for multiple failed login attempts
    const failedAttempts = await this.prisma.auditLog.count({
      where: {
        userId,
        action: 'login_failed',
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Check for multiple IP addresses
    const ipAddresses = await this.prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
      select: {
        ipAddress: true,
      },
      distinct: ['ipAddress'],
    });

    const suspiciousActivity = {
      multipleFailedLogins: failedAttempts >= 5,
      multipleIPs: ipAddresses.length > 3,
      riskLevel: 'low' as 'low' | 'medium' | 'high',
    };

    if (failedAttempts >= 10 || ipAddresses.length > 5) {
      suspiciousActivity.riskLevel = 'high';
    } else if (failedAttempts >= 5 || ipAddresses.length > 3) {
      suspiciousActivity.riskLevel = 'medium';
    }

    return suspiciousActivity;
  }

  async lockUserAccount(userId: number, reason: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await this.logSecurityEvent(userId, 'account_locked', {
      reason,
      lockedAt: new Date(),
    });

    this.logger.warn(`User account locked: ${userId}, reason: ${reason}`);
  }

  async unlockUserAccount(userId: number, unlockedBy: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    await this.logSecurityEvent(userId, 'account_unlocked', {
      unlockedBy,
      unlockedAt: new Date(),
    });

    this.logger.log(`User account unlocked: ${userId}, unlocked by: ${unlockedBy}`);
  }

  async generateSecurityReport(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const [
      totalEvents,
      failedLogins,
      accountLockouts,
      suspiciousActivities,
      topIPs,
      topUsers,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          resource: 'security',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'login_failed',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'account_locked',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { contains: 'suspicious' },
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['ipAddress'],
        where: {
          resource: 'security',
          createdAt: { gte: startDate },
        },
        _count: { ipAddress: true },
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          resource: 'security',
          createdAt: { gte: startDate },
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period,
      startDate,
      endDate: now,
      totalEvents,
      failedLogins,
      accountLockouts,
      suspiciousActivities,
      topIPs: topIPs.map(item => ({
        ipAddress: item.ipAddress,
        eventCount: item._count.ipAddress,
      })),
      topUsers: topUsers.map(item => ({
        userId: item.userId,
        eventCount: item._count.userId,
      })),
    };
  }

  async validatePasswordStrength(password: string) {
    const checks = {
      length: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;
    const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';

    return {
      checks,
      score,
      strength,
      isValid: score >= 4,
    };
  }

  async sanitizeInput(input: string) {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  async rateLimitCheck(identifier: string, limit: number, windowMs: number) {
    const windowStart = new Date(Date.now() - windowMs);
    
    const count = await this.prisma.auditLog.count({
      where: {
        OR: [
          { ipAddress: identifier },
          { userId: parseInt(identifier) || undefined },
        ],
        createdAt: {
          gte: windowStart,
        },
      },
    });

    return {
      allowed: count < limit,
      count,
      remaining: Math.max(0, limit - count),
      resetTime: new Date(Date.now() + windowMs),
    };
  }

  async getSecurityMetrics() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      events24h,
      events7d,
      failedLogins24h,
      lockedAccounts,
      activeUsers,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          resource: 'security',
          createdAt: { gte: last24Hours },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          resource: 'security',
          createdAt: { gte: last7Days },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'login_failed',
          createdAt: { gte: last24Hours },
        },
      }),
      this.prisma.user.count({
        where: { isActive: false },
      }),
      this.prisma.user.count({
        where: { isActive: true },
      }),
    ]);

    return {
      last24Hours: {
        securityEvents: events24h,
        failedLogins: failedLogins24h,
      },
      last7Days: {
        securityEvents: events7d,
      },
      accounts: {
        locked: lockedAccounts,
        active: activeUsers,
        lockRate: activeUsers > 0 ? (lockedAccounts / activeUsers) * 100 : 0,
      },
    };
  }

  async cleanupOldSecurityLogs(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        resource: 'security',
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old security logs`);
    return { deletedCount: result.count };
  }

  async getActivityLog(page = 1, limit = 20, userId?: number) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
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
              platformAdmin: {
                select: { fullName: true },
              },
              salonOwner: {
                select: { fullName: true },
              },
              customer: {
                select: { fullName: true },
              },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              role: log.user.role,
              fullName:
                log.user.platformAdmin?.fullName ??
                log.user.salonOwner?.fullName ??
                log.user.customer?.fullName ??
                'Unknown',
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
