import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { MetricType } from './chart-data.dto';

export enum ComparisonPeriod {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export class TimeComparisonDto {
  @ApiProperty({
    description: 'Metric type to compare',
    enum: MetricType,
    example: MetricType.REVENUE,
  })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({
    description: 'Comparison period',
    enum: ComparisonPeriod,
    example: ComparisonPeriod.MONTH,
  })
  @IsEnum(ComparisonPeriod)
  period: ComparisonPeriod;

  @ApiProperty({
    description: 'Number of periods to compare',
    example: 3,
    required: false,
  })
  @IsOptional()
  periods?: number;

  @ApiProperty({
    description: 'Start date for comparison',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for comparison',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

