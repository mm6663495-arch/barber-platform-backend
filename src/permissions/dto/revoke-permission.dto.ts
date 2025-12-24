import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../common/types/permission-type.enum';

export class RevokePermissionDto {
  @ApiProperty({
    description: 'Permission type to revoke',
    enum: PermissionType,
    example: PermissionType.USERS_DELETE,
  })
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @ApiProperty({
    description: 'Optional reason for revoking the permission',
    example: 'Admin no longer needs delete access',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

