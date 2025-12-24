import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(role?: UserRole, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const where = role ? { role } : {};
    
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          platformAdmin: {
            select: {
              id: true,
              fullName: true,
              lastLogin: true,
            },
          },
          salonOwner: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              subscriptionType: true,
              subscriptionStatus: true,
              subscriptionEndDate: true,
            },
          },
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        platformAdmin: {
          select: {
            id: true,
            fullName: true,
            permissions: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        salonOwner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            subscriptionType: true,
            subscriptionStatus: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            profileImage: true,
            address: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        platformAdmin: {
          select: {
            id: true,
            fullName: true,
            permissions: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        salonOwner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            subscriptionType: true,
            subscriptionStatus: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            profileImage: true,
            address: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto, currentUserRole: UserRole) {
    // Only admins can create users
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create users');
    }

    const { email, password, role, fullName, phone } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role as UserRole,
        isActive: true,
      },
    });

    // Create profile based on role
    let profile;
    if (role === UserRole.SALON_OWNER) {
      profile = await this.prisma.salonOwner.create({
        data: {
          userId: user.id,
          fullName,
          phone: phone || '',
          subscriptionType: 'MONTHLY',
          subscriptionStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (role === UserRole.CUSTOMER) {
      profile = await this.prisma.customer.create({
        data: {
          userId: user.id,
          fullName,
          phone,
        },
      });
    } else if (role === UserRole.ADMIN) {
      profile = await this.prisma.platformAdmin.create({
        data: {
          userId: user.id,
          fullName,
          permissions: {},
        },
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile,
      },
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto, currentUserId: number, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Users can only update their own profile unless they're admin
    if (currentUserRole !== UserRole.ADMIN && currentUserId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const { email, isActive, fullName, phone, profileImage, address, latitude, longitude } = updateUserDto;

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new BadRequestException('Email already taken');
      }
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(email && { email }),
        ...(isActive !== undefined && currentUserRole === UserRole.ADMIN && { isActive }),
      },
    });

    // Update profile based on user role
    let profile;
    if (user.role === UserRole.SALON_OWNER) {
      profile = await this.prisma.salonOwner.update({
        where: { userId: id },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
        },
      });
    } else if (user.role === UserRole.CUSTOMER) {
      profile = await this.prisma.customer.update({
        where: { userId: id },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
          ...(profileImage && { profileImage }),
          ...(address && { address }),
          ...(latitude && { latitude }),
          ...(longitude && { longitude }),
        },
      });
    } else if (user.role === UserRole.ADMIN) {
      profile = await this.prisma.platformAdmin.update({
        where: { userId: id },
        data: {
          ...(fullName && { fullName }),
        },
      });
    }

    return {
      user: updatedUser,
      profile,
    };
  }

  async deactivate(id: number, currentUserRole: UserRole) {
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can deactivate users');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: number, currentUserRole: UserRole) {
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can activate users');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async remove(id: number, currentUserId: number, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only admins can delete users
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Delete user (cascade will handle related records)
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  // ⭐ حذف Admin مع التحقق من الصلاحيات
  async removeAdmin(id: number, currentUserId: number, currentUserRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        platformAdmin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Admin not found');
    }

    // Only admins can delete admins
    if (currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete admins');
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Ensure the user being deleted is an admin
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not an admin');
    }

    // Delete related records first to avoid foreign key constraint violations
    // Use a transaction to ensure all deletions succeed or none do
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete notifications (has userId)
      await tx.notification.deleteMany({
        where: { userId: id },
      });

      // 2. Delete audit logs (has userId)
      await tx.auditLog.deleteMany({
        where: { userId: id },
      });

      // 3. Delete reports where user is reporter or reported user
      await tx.report.deleteMany({
        where: {
          OR: [
            { reporterId: id },
            { reportedUserId: id },
          ],
        },
      });

      // 4. Delete platform admin record (has userId)
      await tx.platformAdmin.deleteMany({
        where: { userId: id },
      });

      // 5. Delete two-factor backup codes (has userId with cascade, but delete explicitly for safety)
      await tx.twoFactorBackupCode.deleteMany({
        where: { userId: id },
      });

      // 6. Finally delete the user
      await tx.user.delete({
        where: { id },
      });
    });

    return {
      success: true,
      message: 'Admin deleted successfully',
    };
  }

  async saveFcmToken(userId: number, fcmToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // حفظ FCM Token في notificationSettings
    const currentSettings = (user.notificationSettings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      fcmToken: fcmToken,
      fcmTokenUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationSettings: updatedSettings,
      },
    });

    return { success: true, message: 'FCM Token saved successfully' };
  }

  async getStatistics() {
    const [
      totalUsers,
      totalAdmins,
      totalSalonOwners,
      totalCustomers,
      activeUsers,
      inactiveUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { role: UserRole.SALON_OWNER } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
    ]);

    return {
      totalUsers,
      totalAdmins,
      totalSalonOwners,
      totalCustomers,
      activeUsers,
      inactiveUsers,
    };
  }

  async getRecentUsers(limit = 10) {
    return this.prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        platformAdmin: {
          select: {
            fullName: true,
          },
        },
        salonOwner: {
          select: {
            fullName: true,
          },
        },
        customer: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * الحصول على إحصائيات المستخدم (Customer)
   */
  async getUserStatistics(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: {
          include: {
            subscriptions: {
              include: {
                package: {
                  include: {
                    salon: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                visits: {
                  select: {
                    id: true,
                    status: true,
                    visitDate: true,
                  },
                },
              },
            },
            reviews: {
              select: {
                id: true,
                rating: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const customer = user.customer;
    const subscriptions = customer.subscriptions;
    const reviews = customer.reviews;

    // إحصائيات الاشتراكات
    const totalSubscriptions = subscriptions.length;
    const activeSubscriptions = subscriptions.filter(
      (sub) => sub.status === 'ACTIVE',
    ).length;
    const expiredSubscriptions = subscriptions.filter(
      (sub) => sub.status === 'EXPIRED',
    ).length;

    // ⭐ إحصائيات الزيارات (بدون الزيارات الملغية)
    const allVisits = subscriptions.flatMap((sub) => sub.visits);
    // ⭐ استبعاد الزيارات الملغية من الإجمالي
    const totalVisits = allVisits.filter((v) => v.status !== 'CANCELLED').length;
    const completedVisits = allVisits.filter(
      (v) => v.status === 'COMPLETED',
    ).length;
    const pendingVisits = allVisits.filter(
      (v) => v.status === 'PENDING',
    ).length;
    const confirmedVisits = allVisits.filter(
      (v) => v.status === 'CONFIRMED',
    ).length;
    const cancelledVisits = allVisits.filter(
      (v) => v.status === 'CANCELLED',
    ).length;

    // إحصائيات التقييمات
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    // إحصائيات الصالونات المفضلة
    let favoriteSalonsCount = 0;
    let favoritePackagesCount = 0;
    
    try {
      favoriteSalonsCount = await this.prisma.favorite.count({
      where: {
        customerId: customer.id,
        salonId: { not: null },
      },
    });

    // إحصائيات الباقات المفضلة
      favoritePackagesCount = await this.prisma.favorite.count({
      where: {
        customerId: customer.id,
        packageId: { not: null },
      },
    });
    } catch (error) {
      // ⭐ في حالة عدم وجود جدول Favorite (مثل قاعدة بيانات قديمة)
      this.logger.warn('Favorite table not found, skipping favorite statistics');
      favoriteSalonsCount = 0;
      favoritePackagesCount = 0;
    }

    // ⭐ إحصائيات حسب الشهر (آخر 6 أشهر) - بدون الزيارات الملغية
    const validVisits = allVisits.filter((v) => v.status !== 'CANCELLED');
    const monthlyStats = this.calculateMonthlyStats(validVisits);

    // ⭐ إحصائيات الصالونات الأكثر زيارة - بدون الزيارات الملغية
    const salonVisitCounts = new Map<number, { name: string; count: number }>();
    subscriptions.forEach((sub) => {
      const salonId = sub.package.salon.id;
      const salonName = sub.package.salon.name;
      // ⭐ حساب الزيارات بدون الملغية
      const visitCount = sub.visits.filter((v) => v.status !== 'CANCELLED').length;

      if (salonVisitCounts.has(salonId)) {
        salonVisitCounts.get(salonId)!.count += visitCount;
      } else {
        salonVisitCounts.set(salonId, {
          name: salonName,
          count: visitCount,
        });
      }
    });

    const topSalons = Array.from(salonVisitCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      overview: {
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        totalVisits,
        completedVisits,
        pendingVisits,
        confirmedVisits,
        cancelledVisits,
        totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        favoriteSalonsCount,
        favoritePackagesCount,
      },
      visits: {
        total: totalVisits,
        byStatus: {
          pending: pendingVisits,
          confirmed: confirmedVisits,
          completed: completedVisits,
          cancelled: cancelledVisits,
        },
        monthlyStats,
      },
      topSalons,
      reviews: {
        total: totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        distribution: this.getRatingDistribution(reviews),
      },
    };
  }

  /**
   * حساب الإحصائيات الشهرية
   */
  private calculateMonthlyStats(visits: any[]) {
    const now = new Date();
    const months: { month: string; count: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ar-SA', {
        month: 'long',
        year: 'numeric',
      });

      const monthVisits = visits.filter((visit) => {
        const visitDate = new Date(visit.visitDate);
        return (
          visitDate.getFullYear() === date.getFullYear() &&
          visitDate.getMonth() === date.getMonth()
        );
      });

      months.push({
        month: monthName,
        count: monthVisits.length,
      });
    }

    return months;
  }

  /**
   * توزيع التقييمات
   */
  private getRatingDistribution(reviews: any[]) {
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    reviews.forEach((review) => {
      const rating = review.rating;
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });

    return distribution;
  }

  /**
   * تصدير قائمة المستخدمين
   */
  async exportUsers(role?: UserRole) {
    const where = role ? { role } : {};
    
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        platformAdmin: {
          select: {
            fullName: true,
            lastLogin: true,
          },
        },
        salonOwner: {
          select: {
            fullName: true,
            phone: true,
            subscriptionType: true,
            subscriptionStatus: true,
          },
        },
        customer: {
          select: {
            fullName: true,
            phone: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: users,
      total: users.length,
    };
  }

  /**
   * استيراد المستخدمين من ملف Excel/CSV
   */
  async importUsers(usersData: Array<{
    email: string;
    password?: string;
    role: UserRole;
    fullName: string;
    phone?: string;
  }>) {
    const results = {
      success: [] as any[],
      failed: [] as Array<{ email: string; error: string }>,
    };

    for (const userData of usersData) {
      try {
        // التحقق من وجود المستخدم
        const existingUser = await this.prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existingUser) {
          results.failed.push({
            email: userData.email,
            error: 'User already exists',
          });
          continue;
        }

        // إنشاء المستخدم
        const createdUser = await this.create(
          {
            email: userData.email,
            password: userData.password || 'TempPassword123!',
            role: userData.role,
            fullName: userData.fullName,
            phone: userData.phone,
          },
          UserRole.ADMIN, // Admin is importing
        );

        results.success.push(createdUser);
      } catch (error: any) {
        results.failed.push({
          email: userData.email,
          error: error.message || 'Unknown error',
        });
      }
    }

    return {
      success: true,
      imported: results.success.length,
      failed: results.failed.length,
      results,
    };
  }

  /**
   * إحصائيات تفصيلية لكل مستخدم
   */
  async getDetailedUserStatistics(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformAdmin: true,
        salonOwner: {
          include: {
            salons: {
              include: {
                packages: true,
                visits: true,
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
                visits: true,
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

    let statistics: any = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    };

    if (user.role === UserRole.ADMIN && user.platformAdmin) {
      statistics.admin = {
        fullName: user.platformAdmin.fullName,
        lastLogin: user.platformAdmin.lastLogin,
        permissions: user.platformAdmin.permissions,
        createdAt: user.platformAdmin.createdAt,
      };
    } else if (user.role === UserRole.SALON_OWNER && user.salonOwner) {
      const salons = user.salonOwner.salons || [];
      const totalPackages = salons.reduce((sum, salon) => sum + (salon.packages?.length || 0), 0);
      const totalVisits = salons.reduce((sum, salon) => sum + (salon.visits?.length || 0), 0);
      const totalReviews = salons.reduce((sum, salon) => sum + (salon.reviews?.length || 0), 0);
      const averageRating = salons.reduce((sum, salon) => sum + (salon.rating || 0), 0) / (salons.length || 1);

      statistics.salonOwner = {
        fullName: user.salonOwner.fullName,
        phone: user.salonOwner.phone,
        subscriptionType: user.salonOwner.subscriptionType,
        subscriptionStatus: user.salonOwner.subscriptionStatus,
        salons: {
          total: salons.length,
          totalPackages,
          totalVisits,
          totalReviews,
          averageRating: Number(averageRating.toFixed(2)),
        },
      };
    } else if (user.role === UserRole.CUSTOMER && user.customer) {
      const subscriptions = user.customer.subscriptions || [];
      const totalVisits = subscriptions.reduce((sum, sub) => sum + (sub.visits?.length || 0), 0);
      const totalSpent = subscriptions.reduce((sum, sub) => {
        const packagePrice = sub.package?.price || 0;
        return sum + packagePrice;
      }, 0);
      const totalReviews = user.customer.reviews?.length || 0;
      const averageRating = user.customer.reviews?.reduce((sum, review) => sum + (review.rating || 0), 0) / (totalReviews || 1) || 0;

      statistics.customer = {
        fullName: user.customer.fullName,
        phone: user.customer.phone,
        address: user.customer.address,
        subscriptions: {
          total: subscriptions.length,
          active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
          expired: subscriptions.filter((s) => s.status === 'EXPIRED').length,
        },
        visits: {
          total: totalVisits,
        },
        spending: {
          total: totalSpent,
        },
        reviews: {
          total: totalReviews,
          averageRating: Number(averageRating.toFixed(2)),
        },
      };
    }

    return {
      success: true,
      data: statistics,
    };
  }
}
