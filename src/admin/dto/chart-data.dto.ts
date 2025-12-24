import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';

export enum ChartType {
  LINE = 'LINE',
  BAR = 'BAR',
  PIE = 'PIE',
  AREA = 'AREA',
  DONUT = 'DONUT',
}

export enum TimeRange {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_3_MONTHS = 'LAST_3_MONTHS',
  LAST_6_MONTHS = 'LAST_6_MONTHS',
  LAST_YEAR = 'LAST_YEAR',
  CUSTOM = 'CUSTOM',
}

export enum MetricType {
  REVENUE = 'REVENUE',
  USERS = 'USERS',
  SALONS = 'SALONS',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  PAYMENTS = 'PAYMENTS',
  REVIEWS = 'REVIEWS',
  VISITS = 'VISITS',
}

export class ChartDataRequestDto {
  @ApiProperty({
    description: 'Chart type',
    enum: ChartType,
    example: ChartType.LINE,
  })
  @IsEnum(ChartType)
  chartType: ChartType;

  @ApiProperty({
    description: 'Metric type',
    enum: MetricType,
    example: MetricType.REVENUE,
  })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({
    description: 'Time range',
    enum: TimeRange,
    example: TimeRange.LAST_30_DAYS,
  })
  @IsEnum(TimeRange)
  timeRange: TimeRange;

  @ApiProperty({
    description: 'Start date (required if timeRange is CUSTOM)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date (required if timeRange is CUSTOM)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Group by field (day, week, month)',
    example: 'day',
    required: false,
  })
  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month';
}

