import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../common/types/permission-type.enum';

export class GrantPermissionDto {
  @ApiProperty({
    description: 'Permission type to grant',
    enum: PermissionType,
    example: PermissionType.USERS_VIEW,
  })
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @ApiProperty({
    description: 'Optional reason for granting the permission',
    example: 'Admin needs access to view users',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

