import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsDateString,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, NotificationType } from '@prisma/client';

export enum BroadcastTarget {
  ALL_USERS = 'ALL_USERS',
  ALL_CUSTOMERS = 'ALL_CUSTOMERS',
  ALL_SALON_OWNERS = 'ALL_SALON_OWNERS',
  ALL_ADMINS = 'ALL_ADMINS',
  SPECIFIC_USERS = 'SPECIFIC_USERS',
  BY_ROLE = 'BY_ROLE',
  BY_SALON = 'BY_SALON',
  ACTIVE_USERS = 'ACTIVE_USERS',
  INACTIVE_USERS = 'INACTIVE_USERS',
}

export class BroadcastNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'إعلان مهم',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'نود إعلامكم بتحديث جديد في النظام',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.GENERAL,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({
    description: 'Broadcast target',
    enum: BroadcastTarget,
    example: BroadcastTarget.ALL_USERS,
  })
  @IsEnum(BroadcastTarget)
  target: BroadcastTarget;

  @ApiProperty({
    description: 'Specific user IDs (required if target is SPECIFIC_USERS)',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  userIds?: number[];

  @ApiProperty({
    description: 'User role (required if target is BY_ROLE)',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'Salon IDs (required if target is BY_SALON)',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  salonIds?: number[];

  @ApiProperty({
    description: 'Additional data for the notification',
    required: false,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Send push notification',
    example: true,
    required: false,
  })
  @IsOptional()
  sendPush?: boolean;

  @ApiProperty({
    description: 'Send email notification',
    example: false,
    required: false,
  })
  @IsOptional()
  sendEmail?: boolean;
}

