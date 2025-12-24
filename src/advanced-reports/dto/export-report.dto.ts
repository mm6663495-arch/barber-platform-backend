import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  JSON = 'JSON',
}

export class ExportReportDto {
  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.PDF,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({
    description: 'Report ID to export',
    example: 'report-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  reportId?: string;

  @ApiProperty({
    description: 'Custom report data (if not using reportId)',
    required: false,
  })
  @IsOptional()
  data?: any;

  @ApiProperty({
    description: 'Include charts in export',
    example: true,
    required: false,
  })
  @IsOptional()
  includeCharts?: boolean;

  @ApiProperty({
    description: 'Template name for PDF export',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  template?: string;
}

