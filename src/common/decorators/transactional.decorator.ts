import { PrismaService } from '../../prisma/prisma.service';

/**
 * Transactional Decorator
 * decorator لتنفيذ العمليات داخل transaction تلقائياً
 * 
 * ⚠️ ملاحظة: هذا decorator بسيط للتوضيح
 * للإنتاج، استخدم مكتبات مثل prisma-nestjs-transactions
 * 
 * @example
 * ```typescript
 * @Transactional()
 * async createSubscription(data: any) {
 *   // سيتم تنفيذ هذه العملية في transaction
 * }
 * ```
 */
export function Transactional(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const prisma: PrismaService = this.prisma || this.prismaService;

      if (!prisma) {
        throw new Error(
          'PrismaService not found. Make sure your service has a prisma or prismaService property.',
        );
      }

      // تنفيذ العملية داخل transaction
      return await prisma.$transaction(async (tx) => {
        // استبدال PrismaService مؤقتاً بـ transaction client
        const originalPrisma = this.prisma || this.prismaService;
        this.prisma = tx;
        this.prismaService = tx;

        try {
          // تنفيذ العملية الأصلية
          return await originalMethod.apply(this, args);
        } finally {
          // إعادة PrismaService الأصلي
          this.prisma = originalPrisma;
          this.prismaService = originalPrisma;
        }
      });
    };

    return descriptor;
  };
}

