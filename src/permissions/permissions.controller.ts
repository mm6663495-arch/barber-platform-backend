import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionType } from '../common/types/permission-type.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('all')
  @ApiOperation({ summary: 'Get all available permissions' })
  @ApiResponse({ status: 200, description: 'List of all permissions' })
  getAllPermissions() {
    return {
      success: true,
      data: {
        permissions: this.permissionsService.getAllPermissions(),
      },
    };
  }

  @Get('admin/:adminId')
  @ApiOperation({ summary: 'Get permissions for a specific admin' })
  @ApiResponse({ status: 200, description: 'Admin permissions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  getAdminPermissions(@Param('adminId', ParseIntPipe) adminId: number) {
    return this.permissionsService.getAdminPermissions(adminId);
  }

  @Patch('admin/:adminId')
  @ApiOperation({ summary: 'Update permissions for a specific admin' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updatePermissions(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Body() updateDto: UpdatePermissionsDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.permissionsService.updatePermissions(
      adminId,
      updateDto,
      currentUser.userId,
    );
  }

  @Post('admin/:adminId/grant')
  @ApiOperation({ summary: 'Grant a specific permission to an admin' })
  @ApiResponse({ status: 201, description: 'Permission granted successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 400, description: 'Permission already granted' })
  grantPermission(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Body() grantDto: GrantPermissionDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.permissionsService.grantPermission(
      adminId,
      grantDto,
      currentUser.userId,
    );
  }

  @Post('admin/:adminId/revoke')
  @ApiOperation({ summary: 'Revoke a specific permission from an admin' })
  @ApiResponse({ status: 200, description: 'Permission revoked successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 400, description: 'Permission already revoked' })
  revokePermission(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Body() revokeDto: RevokePermissionDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.permissionsService.revokePermission(
      adminId,
      revokeDto,
      currentUser.userId,
    );
  }

  @Get('admin/:adminId/history')
  @ApiOperation({ summary: 'Get permission change history for an admin' })
  @ApiResponse({ status: 200, description: 'Permission change history' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  getPermissionHistory(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.permissionsService.getPermissionHistory(adminId, pageNum, limitNum);
  }

  @Get('admins')
  @ApiOperation({ summary: 'Get all admins with their permissions summary' })
  @ApiResponse({ status: 200, description: 'List of admins with permissions' })
  getAllAdminsWithPermissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.permissionsService.getAllAdminsWithPermissions(pageNum, limitNum);
  }

  @Get('check/:adminId/:permissionType')
  @ApiOperation({ summary: 'Check if an admin has a specific permission' })
  @ApiResponse({ status: 200, description: 'Permission check result' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  checkPermission(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('permissionType') permissionType: string,
  ) {
    return this.permissionsService.hasPermission(adminId, permissionType).then(
      (hasPermission) => ({
        success: true,
        data: {
          adminId,
          permissionType,
          hasPermission,
        },
      }),
    );
  }
}

