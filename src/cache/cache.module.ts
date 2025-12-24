import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';

/**
 * Redis Cache Module
 * نظام Caching متقدم باستخدام Redis
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisTtl = configService.get<number>('REDIS_TTL', 3600); // 1 hour default

        try {
          const store = await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
            },
            password: redisPassword,
            ttl: redisTtl * 1000, // Convert to milliseconds
          });

          console.log(`✅ Redis connected successfully at ${redisHost}:${redisPort}`);

          return {
            store,
            ttl: redisTtl * 1000,
          };
        } catch (error) {
          console.warn(
            `⚠️  Redis connection failed, falling back to in-memory cache: ${error.message}`,
          );

          // Fallback to in-memory cache if Redis is not available
          return {
            ttl: redisTtl * 1000,
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}

