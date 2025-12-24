import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PaginationOptions, calculatePagination } from '../dto/pagination.dto';

/**
 * Paginate Decorator
 * decorator لاستخراج معلومات الـ Pagination من الـ request
 * 
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Paginate() pagination: PaginationOptions) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
export const Paginate = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationOptions => {
    const request = ctx.switchToHttp().getRequest();
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;

    return calculatePagination(page, limit);
  },
);

