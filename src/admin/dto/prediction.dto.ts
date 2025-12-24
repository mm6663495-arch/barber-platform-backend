import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { MetricType } from './chart-data.dto';

export class PredictionDto {
  @ApiProperty({
    description: 'Metric type to predict',
    enum: MetricType,
    example: MetricType.REVENUE,
  })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({
    description: 'Number of periods to predict ahead',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  periods?: number;

  @ApiProperty({
    description: 'Period type (day, week, month)',
    example: 'month',
    required: false,
  })
  @IsOptional()
  periodType?: 'day' | 'week' | 'month';

  @ApiProperty({
    description: 'Start date for historical data',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for historical data',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

