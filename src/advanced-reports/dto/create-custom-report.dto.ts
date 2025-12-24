import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum ReportCategory {
  USERS = 'USERS',
  SALONS = 'SALONS',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  PAYMENTS = 'PAYMENTS',
  REVIEWS = 'REVIEWS',
  VISITS = 'VISITS',
  FINANCIAL = 'FINANCIAL',
  ANALYTICS = 'ANALYTICS',
}

export class DateRangeDto {
  @ApiProperty({ description: 'Start date (ISO format)', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO format)', example: '2024-12-31' })
  @IsDateString()
  endDate: string;
}

export class CreateCustomReportDto {
  @ApiProperty({
    description: 'Report name',
    example: 'Monthly Sales Report',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Report category',
    enum: ReportCategory,
    example: ReportCategory.FINANCIAL,
  })
  @IsEnum(ReportCategory)
  category: ReportCategory;

  @ApiProperty({
    description: 'Report period',
    enum: ReportPeriod,
    example: ReportPeriod.MONTHLY,
  })
  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @ApiProperty({
    description: 'Date range (required if period is CUSTOM)',
    type: DateRangeDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ApiProperty({
    description: 'Filters to apply',
    example: { status: 'ACTIVE', role: 'CUSTOMER' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiProperty({
    description: 'Fields to include in the report',
    example: ['id', 'name', 'email', 'createdAt'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @ApiProperty({
    description: 'Group by field',
    example: 'status',
    required: false,
  })
  @IsOptional()
  @IsString()
  groupBy?: string;

  @ApiProperty({
    description: 'Sort by field',
    example: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    required: false,
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

