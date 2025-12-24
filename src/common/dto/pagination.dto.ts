import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Pagination Query DTO
 * DTO للـ Pagination في جميع الاستعلامات
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'رقم الصفحة (يبدأ من 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'عدد العناصر في الصفحة',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * Pagination Meta Data
 * معلومات إضافية عن الـ Pagination
 */
export interface PaginationMeta {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated Response DTO
 * الاستجابة القياسية للـ Pagination
 */
export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    const totalPages = Math.ceil(total / limit);
    
    this.meta = {
      currentPage: page,
      itemsPerPage: limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

/**
 * Pagination Options
 * خيارات الـ Pagination للاستخدام الداخلي
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * حساب قيم الـ Pagination
 */
export function calculatePagination(
  page: number = 1,
  limit: number = 10,
): PaginationOptions {
  const skip = (page - 1) * limit;
  return {
    page,
    limit,
    skip,
    take: limit,
  };
}

