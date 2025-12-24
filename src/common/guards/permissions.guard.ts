import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionType } from '../types/permission-type.enum';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionType[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const { user } = context.switchToHttp().getRequest();

    // Only check permissions for ADMIN role
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }

    // Get admin profile
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { userId: user.userId },
    });

    if (!admin) {
      throw new ForbiddenException('Admin profile not found');
    }

    const permissions = (admin.permissions as Record<string, boolean>) || {};

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some(
      (permission) => permissions[permission] === true,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permission. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}

