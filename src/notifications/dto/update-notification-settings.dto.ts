import { IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class QuietHoursDto {
  @ApiPropertyOptional({ description: 'Enable quiet hours' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Start time (HH:mm format)' })
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (HH:mm format)' })
  @IsOptional()
  endTime?: string;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Enable push notifications' })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable SMS notifications' })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable new customer notifications' })
  @IsOptional()
  @IsBoolean()
  newCustomerNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable appointment reminders' })
  @IsOptional()
  @IsBoolean()
  appointmentReminders?: boolean;

  @ApiPropertyOptional({ description: 'Enable payment notifications' })
  @IsOptional()
  @IsBoolean()
  paymentNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable review notifications' })
  @IsOptional()
  @IsBoolean()
  reviewNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable promotion notifications' })
  @IsOptional()
  @IsBoolean()
  promotionNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable system updates notifications' })
  @IsOptional()
  @IsBoolean()
  systemUpdates?: boolean;

  @ApiPropertyOptional({ description: 'Quiet hours settings', type: QuietHoursDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;
}

