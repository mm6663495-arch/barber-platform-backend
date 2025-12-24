import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { BroadcastNotificationDto, BroadcastTarget } from './broadcast-notification.dto';
import { NotificationType } from '@prisma/client';

export class ScheduleNotificationDto extends BroadcastNotificationDto {
  @ApiProperty({
    description: 'Scheduled date and time (ISO format)',
    example: '2024-12-25T10:00:00Z',
  })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    description: 'Timezone for scheduled time',
    example: 'UTC',
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    description: 'Repeat notification',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  repeat?: boolean;

  @ApiProperty({
    description: 'Repeat interval (daily, weekly, monthly)',
    example: 'daily',
    required: false,
  })
  @IsOptional()
  @IsString()
  repeatInterval?: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({
    description: 'End date for repeated notifications',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  repeatUntil?: string;
}

