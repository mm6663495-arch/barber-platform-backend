import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdmin } from '@prisma/client';
import { PermissionType } from '../common/types/permission-type.enum';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all available permissions
   */
  getAllPermissions(): string[] {
    return Object.values(PermissionType) as string[];
  }

  /**
   * Get permissions for a specific admin
   */
  async getAdminPermissions(adminId: number) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        permissions: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const permissions = (admin.permissions as Record<string, boolean>) || {};

    return {
      success: true,
      data: {
        admin: {
          id: admin.id,
          userId: admin.userId,
          fullName: admin.fullName,
          email: admin.user.email,
          role: admin.user.role,
          isActive: admin.user.isActive,
        },
        permissions,
        allPermissions: this.getAllPermissions(),
      },
    };
  }

  /**
   * Update permissions for a specific admin
   */
  async updatePermissions(
    adminId: number,
    updateDto: UpdatePermissionsDto,
    changedBy: number,
  ) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Verify that the changer is also an admin
    const changer = await this.prisma.user.findUnique({
      where: { id: changedBy },
      include: { platformAdmin: true },
    });

    if (!changer || changer.role !== 'ADMIN' || !changer.platformAdmin) {
      throw new ForbiddenException('Only admins can change permissions');
    }

    const previousPermissions = (admin.permissions as Record<string, boolean>) || {};
    const newPermissions = updateDto.permissions;

    // Validate all permission types
    const allPermissionTypes = this.getAllPermissions();
    for (const key of Object.keys(newPermissions)) {
      if (!allPermissionTypes.includes(key)) {
        throw new BadRequestException(`Invalid permission type: ${key}`);
      }
    }

    // Update permissions
    const updatedAdmin = await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        permissions: newPermissions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    // Log permission changes
    const changes: Array<{
      permissionType: string;
      previousValue: boolean | null;
      newValue: boolean;
    }> = [];

    for (const permissionType of allPermissionTypes) {
      const previousValue = previousPermissions[permissionType] ?? null;
      const newValue = newPermissions[permissionType] ?? false;

      if (previousValue !== newValue) {
        changes.push({
          permissionType,
          previousValue,
          newValue,
        });

        // Log each change
        await (this.prisma as any).permissionChangeLog.create({
          data: {
            adminId,
            changedBy,
            permissionType: permissionType as string,
            action: newValue ? 'GRANTED' : 'REVOKED',
            previousValue,
            newValue,
            reason: updateDto.reason,
          },
        });
      }
    }

    return {
      success: true,
      data: {
        admin: {
          id: updatedAdmin.id,
          userId: updatedAdmin.userId,
          fullName: updatedAdmin.fullName,
          email: updatedAdmin.user.email,
        },
        permissions: newPermissions,
        changesCount: changes.length,
      },
    };
  }

  /**
   * Grant a specific permission to an admin
   */
  async grantPermission(
    adminId: number,
    grantDto: GrantPermissionDto,
    changedBy: number,
  ) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const permissions = (admin.permissions as Record<string, boolean>) || {};
    const previousValue = permissions[grantDto.permissionType] ?? false;

    if (previousValue === true) {
      throw new BadRequestException('Permission already granted');
    }

    permissions[grantDto.permissionType] = true;

    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        permissions,
      },
    });

    // Log the change
    await (this.prisma as any).permissionChangeLog.create({
      data: {
        adminId,
        changedBy,
        permissionType: grantDto.permissionType,
        action: 'GRANTED',
        previousValue,
        newValue: true,
        reason: grantDto.reason,
      },
    });

    return {
      success: true,
      message: 'Permission granted successfully',
      data: {
        permissionType: grantDto.permissionType,
        granted: true,
      },
    };
  }

  /**
   * Revoke a specific permission from an admin
   */
  async revokePermission(
    adminId: number,
    revokeDto: RevokePermissionDto,
    changedBy: number,
  ) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const permissions = (admin.permissions as Record<string, boolean>) || {};
    const previousValue = permissions[revokeDto.permissionType] ?? false;

    if (previousValue === false) {
      throw new BadRequestException('Permission already revoked');
    }

    permissions[revokeDto.permissionType] = false;

    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        permissions,
      },
    });

    // Log the change
    await (this.prisma as any).permissionChangeLog.create({
      data: {
        adminId,
        changedBy,
        permissionType: revokeDto.permissionType,
        action: 'REVOKED',
        previousValue,
        newValue: false,
        reason: revokeDto.reason,
      },
    });

    return {
      success: true,
      message: 'Permission revoked successfully',
      data: {
        permissionType: revokeDto.permissionType,
        revoked: true,
      },
    };
  }

  /**
   * Get permission change history for an admin
   */
  async getPermissionHistory(adminId: number, page = 1, limit = 10) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const skip = (page - 1) * limit;

    const [changes, total] = await Promise.all([
      (this.prisma as any).permissionChangeLog.findMany({
        where: { adminId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          changedByUser: {
            select: {
              id: true,
              email: true,
              platformAdmin: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      (this.prisma as any).permissionChangeLog.count({
        where: { adminId },
      }),
    ]);

    return {
      success: true,
      data: changes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if an admin has a specific permission
   */
  async hasPermission(
    adminId: number,
    permissionType: string,
  ): Promise<boolean> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return false;
    }

    const permissions = (admin.permissions as Record<string, boolean>) || {};
    return permissions[permissionType] === true;
  }

  /**
   * Get all admins with their permissions summary
   */
  async getAllAdminsWithPermissions(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      this.prisma.platformAdmin.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.platformAdmin.count(),
    ]);

    const adminsWithPermissions = admins.map((admin) => {
      const permissions = (admin.permissions as Record<string, boolean>) || {};
      const grantedPermissions = Object.keys(permissions).filter(
        (key) => permissions[key] === true,
      );

      return {
        id: admin.id,
        userId: admin.userId,
        fullName: admin.fullName,
        email: admin.user.email,
        isActive: admin.user.isActive,
        permissionsCount: grantedPermissions.length,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      };
    });

    return {
      success: true,
      data: adminsWithPermissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

