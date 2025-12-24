import { PrismaService } from '../../prisma/prisma.service';
import { PaginationOptions, PaginatedResponseDto } from '../dto/pagination.dto';

/**
 * Base Repository Interface
 * الواجهة الأساسية لجميع الـ Repositories
 */
export interface IBaseRepository<T> {
  findAll(options?: any): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  create(data: any): Promise<T>;
  update(id: number, data: any): Promise<T>;
  delete(id: number): Promise<T>;
  count(where?: any): Promise<number>;
}

/**
 * Base Repository Class
 * الكلاس الأساسي لجميع الـ Repositories
 * يوفر العمليات الأساسية CRUD
 */
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected abstract model: any;

  constructor(protected readonly prisma: PrismaService) {}

  /**
   * إيجاد جميع السجلات مع دعم Pagination
   */
  async findAll(options?: any): Promise<T[]> {
    return this.model.findMany(options);
  }

  /**
   * إيجاد سجل بواسطة ID
   */
  async findById(id: number): Promise<T | null> {
    return this.model.findUnique({
      where: { id },
    });
  }

  /**
   * إنشاء سجل جديد
   */
  async create(data: any): Promise<T> {
    return this.model.create({
      data,
    });
  }

  /**
   * تحديث سجل موجود
   */
  async update(id: number, data: any): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * حذف سجل
   */
  async delete(id: number): Promise<T> {
    return this.model.delete({
      where: { id },
    });
  }

  /**
   * عد السجلات
   */
  async count(where?: any): Promise<number> {
    return this.model.count({ where });
  }

  /**
   * إيجاد سجلات مع Pagination
   */
  async findWithPagination(
    pagination: PaginationOptions,
    options?: any,
  ): Promise<PaginatedResponseDto<T>> {
    const { skip, take, page, limit } = pagination;

    const [data, total] = await Promise.all([
      this.model.findMany({
        ...options,
        skip,
        take,
      }),
      this.count(options?.where),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * إيجاد سجل واحد بناءً على شروط
   */
  async findOne(where: any): Promise<T | null> {
    return this.model.findFirst({ where });
  }

  /**
   * تحديث سجلات متعددة
   */
  async updateMany(where: any, data: any): Promise<{ count: number }> {
    return this.model.updateMany({
      where,
      data,
    });
  }

  /**
   * حذف سجلات متعددة
   */
  async deleteMany(where: any): Promise<{ count: number }> {
    return this.model.deleteMany({ where });
  }

  /**
   * فحص وجود سجل
   */
  async exists(where: any): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
}

