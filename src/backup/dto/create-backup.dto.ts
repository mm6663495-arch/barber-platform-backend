import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BackupType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
}

export class CreateBackupDto {
  @ApiPropertyOptional({
    description: 'Type of backup',
    enum: BackupType,
    default: BackupType.FULL,
  })
  @IsOptional()
  @IsEnum(BackupType)
  type?: BackupType;

  @ApiPropertyOptional({ description: 'Description for the backup' })
  @IsOptional()
  @IsString()
  description?: string;
}

