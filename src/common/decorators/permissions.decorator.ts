import { SetMetadata } from '@nestjs/common';
import { PermissionType } from '../types/permission-type.enum';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

