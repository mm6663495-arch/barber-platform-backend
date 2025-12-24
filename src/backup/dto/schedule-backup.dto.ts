import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { BackupType } from './create-backup.dto';

export enum BackupSchedule {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export class ScheduleBackupDto {
  @ApiProperty({
    description: 'Backup schedule frequency',
    enum: BackupSchedule,
    example: BackupSchedule.DAILY,
  })
  @IsEnum(BackupSchedule)
  schedule: BackupSchedule;

  @ApiProperty({
    description: 'Backup type',
    enum: BackupType,
    example: BackupType.FULL,
    required: false,
  })
  @IsOptional()
  @IsEnum(BackupType)
  type?: BackupType;

  @ApiProperty({
    description: 'Time for scheduled backup (HH:mm format)',
    example: '02:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({
    description: 'Day of week for weekly backup (0-6, Sunday-Saturday)',
    example: 1,
    required: false,
  })
  @IsOptional()
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Day of month for monthly backup (1-31)',
    example: 1,
    required: false,
  })
  @IsOptional()
  dayOfMonth?: number;

  @ApiProperty({
    description: 'Enable automatic backup',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Retention days (how long to keep backups)',
    example: 30,
    required: false,
  })
  @IsOptional()
  retentionDays?: number;
}

