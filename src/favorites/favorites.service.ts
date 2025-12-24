import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CreateFavoriteListDto } from './dto/create-favorite-list.dto';
import { UpdateFavoriteListDto } from './dto/update-favorite-list.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  /**
   * إضافة صالون أو باقة للمفضلة
   */
  async createFavorite(customerId: number, createDto: CreateFavoriteDto) {
    // التحقق من أن إما salonId أو packageId موجود
    if (!createDto.salonId && !createDto.packageId) {
      throw new BadRequestException(
        'Either salonId or packageId must be provided',
      );
    }

    // التحقق من أن الصالون أو الباقة موجودة
    if (createDto.salonId) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: createDto.salonId },
      });
      if (!salon) {
        throw new NotFoundException('Salon not found');
      }
    }

    if (createDto.packageId) {
      const package_ = await this.prisma.package.findUnique({
        where: { id: createDto.packageId },
      });
      if (!package_) {
        throw new NotFoundException('Package not found');
      }
    }

    // التحقق من وجود القائمة إذا تم تحديدها
    if (createDto.listId) {
      const list = await this.prisma.favoriteList.findFirst({
        where: {
          id: createDto.listId,
          customerId: customerId,
        },
      });
      if (!list) {
        throw new NotFoundException('Favorite list not found');
      }
    }

    // التحقق من عدم التكرار
    const existing = await this.prisma.favorite.findFirst({
      where: {
        customerId,
        salonId: createDto.salonId || null,
        packageId: createDto.packageId || null,
      },
    });

    if (existing) {
      throw new BadRequestException('Already in favorites');
    }

    // إنشاء المفضلة
    const favorite = await this.prisma.favorite.create({
      data: {
        customerId,
        salonId: createDto.salonId,
        packageId: createDto.packageId,
        listId: createDto.listId,
        notes: createDto.notes,
      },
      include: {
        salon: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
              },
            },
            _count: {
              select: {
                reviews: true,
                packages: true,
              },
            },
          },
        },
        package: {
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
        list: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return favorite;
  }

  /**
   * جلب جميع المفضلة للمستخدم
   */
  async getUserFavorites(customerId: number, listId?: number) {
    const where: any = { customerId };
    if (listId) {
      where.listId = listId;
    }

    const favorites = await this.prisma.favorite.findMany({
      where,
      include: {
        salon: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
              },
            },
            _count: {
              select: {
                reviews: true,
                packages: true,
              },
            },
          },
        },
        package: {
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
        list: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return favorites;
  }

  /**
   * حذف من المفضلة
   */
  async removeFavorite(customerId: number, favoriteId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { id: favoriteId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    if (favorite.customerId !== customerId) {
      throw new ForbiddenException('You can only delete your own favorites');
    }

    await this.prisma.favorite.delete({
      where: { id: favoriteId },
    });

    return { success: true, message: 'Favorite removed successfully' };
  }

  /**
   * التحقق من وجود صالون أو باقة في المفضلة
   */
  async isFavorite(
    customerId: number,
    salonId?: number,
    packageId?: number,
  ): Promise<boolean> {
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        customerId,
        salonId: salonId || null,
        packageId: packageId || null,
      },
    });

    return !!favorite;
  }

  /**
   * إنشاء قائمة مفضلة جديدة
   */
  async createFavoriteList(
    customerId: number,
    createDto: CreateFavoriteListDto,
  ) {
    // إذا كانت القائمة الافتراضية، إلغاء الافتراضية من القوائم الأخرى
    if (createDto.isDefault) {
      await this.prisma.favoriteList.updateMany({
        where: {
          customerId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const list = await this.prisma.favoriteList.create({
      data: {
        customerId,
        name: createDto.name,
        description: createDto.description,
        color: createDto.color,
        icon: createDto.icon,
        isDefault: createDto.isDefault || false,
      },
    });

    return list;
  }

  /**
   * جلب جميع قوائم المفضلة للمستخدم
   */
  async getUserFavoriteLists(customerId: number) {
    const lists = await this.prisma.favoriteList.findMany({
      where: { customerId },
      include: {
        _count: {
          select: {
            favorites: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return lists;
  }

  /**
   * تحديث قائمة مفضلة
   */
  async updateFavoriteList(
    customerId: number,
    listId: number,
    updateDto: UpdateFavoriteListDto,
  ) {
    const list = await this.prisma.favoriteList.findFirst({
      where: {
        id: listId,
        customerId,
      },
    });

    if (!list) {
      throw new NotFoundException('Favorite list not found');
    }

    // إذا كانت القائمة الافتراضية، إلغاء الافتراضية من القوائم الأخرى
    if (updateDto.isDefault) {
      await this.prisma.favoriteList.updateMany({
        where: {
          customerId,
          isDefault: true,
          id: { not: listId },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updated = await this.prisma.favoriteList.update({
      where: { id: listId },
      data: updateDto,
    });

    return updated;
  }

  /**
   * حذف قائمة مفضلة
   */
  async deleteFavoriteList(customerId: number, listId: number) {
    const list = await this.prisma.favoriteList.findFirst({
      where: {
        id: listId,
        customerId,
      },
    });

    if (!list) {
      throw new NotFoundException('Favorite list not found');
    }

    // حذف جميع المفضلة في القائمة
    await this.prisma.favorite.deleteMany({
      where: { listId },
    });

    // حذف القائمة
    await this.prisma.favoriteList.delete({
      where: { id: listId },
    });

    return { success: true, message: 'Favorite list deleted successfully' };
  }
}

