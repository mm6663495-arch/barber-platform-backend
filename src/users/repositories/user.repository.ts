import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../../common/repositories/base.repository';
import { User, UserRole, Prisma } from '@prisma/client';
import { PaginationOptions, PaginatedResponseDto } from '../../common/dto/pagination.dto';

/**
 * User Repository
 * Repository للتعامل مع Users في قاعدة البيانات
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  protected model: any;

  constructor(prisma: PrismaService) {
    super(prisma);
    this.model = prisma.user;
  }

  /**
   * إيجاد مستخدمين بفلترة متقدمة مع Pagination
   */
  async findWithFilters(
    pagination: PaginationOptions,
    filters: {
      role?: UserRole;
      isActive?: boolean;
      emailVerified?: boolean;
      search?: string;
    },
  ): Promise<PaginatedResponseDto<User>> {
    const { skip, take, page, limit } = pagination;
    const where: Prisma.UserWhereInput = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.emailVerified !== undefined) {
      where.emailVerified = filters.emailVerified;
    }

    if (filters.search) {
      where.email = {
        contains: filters.search,
      };
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          platformAdmin: true,
          salonOwner: true,
          customer: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.count(where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * إيجاد مستخدم بالإيميل
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.model.findUnique({
      where: { email },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });
  }

  /**
   * إيجاد مستخدم بـ Reset Token
   */
  async findByResetToken(resetToken: string): Promise<User | null> {
    return this.model.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * إيجاد مستخدم بالـ ID مع التفاصيل
   */
  async findByIdWithProfile(id: number): Promise<User | null> {
    return this.model.findUnique({
      where: { id },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });
  }

  /**
   * تحديث آخر تسجيل دخول
   */
  async updateLastLogin(userId: number, role: UserRole): Promise<void> {
    if (role === UserRole.ADMIN) {
      // جلب PlatformAdmin مباشرة
      const platformAdmin = await this.prisma.platformAdmin.findUnique({
        where: { userId },
      });
      
      if (platformAdmin) {
        await this.prisma.platformAdmin.update({
          where: { id: platformAdmin.id },
          data: { lastLogin: new Date() },
        });
      }
    }
  }

  /**
   * إحصائيات المستخدمين
   */
  async getStatistics(): Promise<{
    total: number;
    admins: number;
    salonOwners: number;
    customers: number;
    active: number;
    inactive: number;
    verifiedEmails: number;
    twoFactorEnabled: number;
  }> {
    const [
      total,
      admins,
      salonOwners,
      customers,
      active,
      inactive,
      verifiedEmails,
      twoFactorEnabled,
    ] = await Promise.all([
      this.count(),
      this.count({ role: UserRole.ADMIN }),
      this.count({ role: UserRole.SALON_OWNER }),
      this.count({ role: UserRole.CUSTOMER }),
      this.count({ isActive: true }),
      this.count({ isActive: false }),
      this.count({ emailVerified: true }),
      this.count({ twoFactorEnabled: true }),
    ]);

    return {
      total,
      admins,
      salonOwners,
      customers,
      active,
      inactive,
      verifiedEmails,
      twoFactorEnabled,
    };
  }

  /**
   * إيجاد مستخدمين غير نشطين لفترة طويلة
   */
  async findInactive(daysInactive: number, pagination: PaginationOptions): Promise<PaginatedResponseDto<User>> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysInactive);

    const { skip, take, page, limit } = pagination;

    const where: Prisma.UserWhereInput = {
      isActive: true,
      updatedAt: {
        lt: dateThreshold,
      },
    };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          updatedAt: true,
        },
        skip,
        take,
        orderBy: { updatedAt: 'asc' },
      }),
      this.count(where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * حذف بيانات المستخدم بشكل كامل (GDPR compliance)
   */
  async deleteUserData(userId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // حذف البيانات المرتبطة
      await tx.notification.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
      
      // حذف البروفايل حسب النوع
      // حذف PlatformAdmin إذا وجد
      const platformAdmin = await tx.platformAdmin.findUnique({ where: { userId } });
      if (platformAdmin) {
        await tx.platformAdmin.delete({ where: { id: platformAdmin.id } });
      }

      // حذف SalonOwner إذا وجد
      const salonOwner = await tx.salonOwner.findUnique({ where: { userId } });
      if (salonOwner) {
        await tx.salonOwner.delete({ where: { id: salonOwner.id } });
      }

      // حذف Customer إذا وجد
      const customer = await tx.customer.findUnique({ where: { userId } });
      if (customer) {
        await tx.customer.delete({ where: { id: customer.id } });
      }

      // حذف المستخدم
      await tx.user.delete({ where: { id: userId } });
    });
  }
}

