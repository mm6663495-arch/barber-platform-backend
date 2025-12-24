import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../common/types/permission-type.enum';

export class UpdatePermissionsDto {
  @ApiProperty({
    description: 'Permissions object with PermissionType as keys and boolean as values',
    example: {
      USERS_VIEW: true,
      USERS_CREATE: false,
      SALONS_VIEW: true,
    },
  })
  @IsObject()
  permissions: Record<PermissionType, boolean>;

  @ApiProperty({
    description: 'Optional reason for the permission change',
    example: 'Granting access to manage users',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

