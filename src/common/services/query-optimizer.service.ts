import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Query Optimizer Service
 * خدمة لتحسين الاستعلامات وتقليل عدد الـ database calls
 */
@Injectable()
export class QueryOptimizerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Batch Loading Pattern
   * جلب عدة عناصر دفعة واحدة بدلاً من استعلام لكل عنصر
   */
  async batchLoad<T>(
    model: any,
    ids: number[],
    select?: any,
  ): Promise<Map<number, T>> {
    const items = await model.findMany({
      where: { id: { in: ids } },
      select,
    });

    const map = new Map<number, T>();
    items.forEach((item: any) => map.set(item.id, item));
    
    return map;
  }

  /**
   * DataLoader Pattern
   * جمع الطلبات المتعددة وتنفيذها دفعة واحدة
   */
  createDataLoader<T>(
    fetchFunction: (ids: number[]) => Promise<T[]>,
    getId: (item: T) => number,
  ) {
    let queue: Array<{
      id: number;
      resolve: (value: T | null) => void;
      reject: (error: any) => void;
    }> = [];
    
    let scheduled = false;

    const load = (id: number): Promise<T | null> => {
      return new Promise((resolve, reject) => {
        queue.push({ id, resolve, reject });

        if (!scheduled) {
          scheduled = true;
          
          // تنفيذ في المرة القادمة من event loop
          setImmediate(async () => {
            scheduled = false;
            const currentQueue = queue;
            queue = [];

            try {
              const ids = currentQueue.map(q => q.id);
              const items = await fetchFunction(ids);
              const itemMap = new Map(items.map(item => [getId(item), item]));

              currentQueue.forEach(({ id, resolve }) => {
                resolve(itemMap.get(id) || null);
              });
            } catch (error) {
              currentQueue.forEach(({ reject }) => reject(error));
            }
          });
        }
      });
    };

    return { load };
  }

  /**
   * Optimized Count with Filter
   * عد ذكي يستخدم الـ indexes
   */
  async optimizedCount(
    model: any,
    where: any,
    useApproximation: boolean = false,
  ): Promise<number> {
    if (useApproximation && Object.keys(where).length === 0) {
      // للـ full table count، استخدم approximate count (أسرع)
      const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM ${model}
      `;
      return Number(result[0].count);
    }

    // للـ filtered count، استخدم الطريقة العادية
    return model.count({ where });
  }

  /**
   * Cursor-based Pagination
   * Pagination أسرع للـ datasets الكبيرة
   */
  async cursorPagination<T>(
    model: any,
    options: {
      cursor?: number;
      take: number;
      where?: any;
      orderBy?: any;
      select?: any;
    },
  ): Promise<{
    items: T[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    const { cursor, take, where, orderBy, select } = options;

    const items = await model.findMany({
      take: take + 1, // جلب عنصر إضافي للتحقق من وجود المزيد
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      where,
      orderBy: orderBy || { id: 'asc' },
      select,
    });

    const hasMore = items.length > take;
    const results = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
      items: results,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Parallel Queries
   * تنفيذ استعلامات متعددة بالتوازي
   */
  async parallelQueries<T extends any[]>(
    queries: Array<() => Promise<any>>,
  ): Promise<T> {
    return Promise.all(queries.map(query => query())) as Promise<T>;
  }

  /**
   * Query with Includes Optimization
   * تحسين الاستعلامات مع الـ includes
   */
  async optimizedFindWithIncludes<T>(
    model: any,
    id: number,
    includes: {
      required: string[];      // relations ضرورية
      optional?: string[];     // relations اختيارية (lazy load)
      select?: Record<string, any>; // حقول محددة فقط
    },
  ): Promise<T> {
    // جلب البيانات الأساسية والـ relations الضرورية
    const includeObj: any = {};
    includes.required.forEach(rel => {
      includeObj[rel] = includes.select?.[rel] ? { select: includes.select[rel] } : true;
    });

    const data = await model.findUnique({
      where: { id },
      include: includeObj,
    });

    // جلب الـ optional relations فقط عند الحاجة
    if (includes.optional && data) {
      const optionalIncludes: any = {};
      includes.optional.forEach(rel => {
        optionalIncludes[rel] = includes.select?.[rel] 
          ? { select: includes.select[rel] } 
          : true;
      });

      const optionalData = await model.findUnique({
        where: { id },
        select: optionalIncludes,
      });

      Object.assign(data, optionalData);
    }

    return data;
  }

  /**
   * Aggregate Optimization
   * تحسين استعلامات التجميع
   */
  async optimizedAggregate(
    model: any,
    aggregations: {
      count?: boolean;
      sum?: string[];
      avg?: string[];
      min?: string[];
      max?: string[];
    },
    where?: any,
  ): Promise<any> {
    const aggregate: any = {};

    if (aggregations.count) aggregate._count = true;
    
    if (aggregations.sum) {
      aggregate._sum = {};
      aggregations.sum.forEach(field => aggregate._sum[field] = true);
    }
    
    if (aggregations.avg) {
      aggregate._avg = {};
      aggregations.avg.forEach(field => aggregate._avg[field] = true);
    }
    
    if (aggregations.min) {
      aggregate._min = {};
      aggregations.min.forEach(field => aggregate._min[field] = true);
    }
    
    if (aggregations.max) {
      aggregate._max = {};
      aggregations.max.forEach(field => aggregate._max[field] = true);
    }

    return model.aggregate({
      where,
      ...aggregate,
    });
  }

  /**
   * Index Hint (MySQL specific)
   * إرشاد MySQL لاستخدام index محدد
   */
  async queryWithIndexHint(
    sql: string,
    indexName: string,
    params: any[] = [],
  ): Promise<any> {
    // استخدام raw query مع index hint
    const hintedSql = sql.replace(
      /FROM\s+(\w+)/i,
      `FROM $1 USE INDEX (${indexName})`,
    );
    
    return this.prisma.$queryRawUnsafe(hintedSql, ...params);
  }

  /**
   * Query Explain
   * تحليل خطة تنفيذ الاستعلام
   */
  async explainQuery(query: string): Promise<any> {
    return this.prisma.$queryRawUnsafe(`EXPLAIN ${query}`);
  }
}

