import { PrismaService } from '../../prisma/prisma.service';

/**
 * Transaction Helper
 * مساعد لتنفيذ العمليات داخل transactions بشكل آمن
 */
export class TransactionHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * تنفيذ عملية داخل transaction
   * 
   * @example
   * ```typescript
   * await this.transactionHelper.execute(async (tx) => {
   *   await tx.subscription.update({...});
   *   await tx.visit.create({...});
   * });
   * ```
   */
  async execute<T>(
    callback: (tx: any) => Promise<T>,
    options?: {
      maxWait?: number; // الحد الأقصى للانتظار (ms)
      timeout?: number; // timeout للـ transaction (ms)
    },
  ): Promise<T> {
    return await this.prisma.$transaction(callback, {
      maxWait: options?.maxWait || 5000, // 5 ثواني افتراضياً
      timeout: options?.timeout || 10000, // 10 ثواني افتراضياً
    });
  }

  /**
   * تنفيذ عمليات متعددة بشكل متتالي داخل transaction
   */
  async executeMultiple<T>(
    operations: ((tx: any) => Promise<any>)[],
  ): Promise<T[]> {
    return await this.prisma.$transaction(async (tx) => {
      const results: T[] = [];
      
      for (const operation of operations) {
        const result = await operation(tx);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * تنفيذ transaction مع retry في حالة الفشل
   */
  async executeWithRetry<T>(
    callback: (tx: any) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(callback);
      } catch (error) {
        lastError = error;
        
        // في حالة deadlock أو timeout، حاول مرة أخرى
        if (attempt < maxRetries && this.isRetriableError(error)) {
          await this.delay(attempt * 100); // exponential backoff
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * فحص إذا كان الخطأ يستحق إعادة المحاولة
   */
  private isRetriableError(error: any): boolean {
    const retriableCodes = [
      'P2034', // Transaction conflict
      'P2024', // Timed out
    ];
    
    return retriableCodes.some(code => error.code === code);
  }

  /**
   * تأخير بسيط
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

