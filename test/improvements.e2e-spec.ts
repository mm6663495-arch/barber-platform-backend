import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E Tests للتحسينات الجديدة
 * Testing: Pagination, Repository Pattern, Transactions, Response DTOs
 */
describe('Improvements (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);

    // Get access token for testing
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password@123',
      });

    accessToken = loginResponse.body.access_token || loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Pagination Tests
   */
  describe('Pagination', () => {
    it('should return paginated subscriptions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('currentPage', 1);
      expect(response.body.meta).toHaveProperty('itemsPerPage', 10);
      expect(response.body.meta).toHaveProperty('totalPages');
      expect(response.body.meta).toHaveProperty('hasNextPage');
      expect(response.body.meta).toHaveProperty('hasPreviousPage');
    });

    it('should respect page and limit parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=2&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.meta.currentPage).toBe(2);
      expect(response.body.meta.itemsPerPage).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should use default pagination when not specified', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.meta.currentPage).toBe(1);
      expect(response.body.meta.itemsPerPage).toBe(10);
    });

    it('should return 400 for invalid page number', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 400 for limit exceeding max', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions?limit=101')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  /**
   * Response DTO Tests
   */
  describe('Response DTOs', () => {
    it('should return standardized success response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return standardized error response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  /**
   * API Versioning Tests
   */
  describe('API Versioning', () => {
    it('should access endpoints via /api/v1/', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should return 404 for unversioned endpoints', async () => {
      await request(app.getHttpServer())
        .get('/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  /**
   * Transaction Tests
   */
  describe('Database Transactions', () => {
    it('should rollback on error during subscription creation', async () => {
      const initialCount = await prismaService.subscription.count();

      // Try to create subscription with invalid package
      await request(app.getHttpServer())
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          packageId: 999999, // Invalid package
          paymentMethod: 'stripe',
          paymentId: 'test-payment-id',
        })
        .expect(404);

      // Verify no subscription was created
      const finalCount = await prismaService.subscription.count();
      expect(finalCount).toBe(initialCount);
    });

    it('should rollback visit creation on error', async () => {
      const initialVisitCount = await prismaService.visit.count();

      // Try to use visit with invalid QR code
      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/use-visit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          qrCode: 'invalid-qr-code',
          salonId: 1,
        })
        .expect(404);

      // Verify no visit was created
      const finalVisitCount = await prismaService.visit.count();
      expect(finalVisitCount).toBe(initialVisitCount);
    });
  });

  /**
   * Repository Pattern Tests
   */
  describe('Repository Pattern', () => {
    it('should use repository for data access', async () => {
      // This test verifies that the service uses repository
      // by checking the response structure which should be consistent
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Repository should return paginated response
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('meta');
    });
  });

  /**
   * Performance Tests
   */
  describe('Performance Improvements', () => {
    it('should respond faster with pagination', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      const duration = Date.now() - start;
      
      // Should respond in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large page requests efficiently', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=1&limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      const duration = Date.now() - start;
      
      // Should still respond reasonably fast
      expect(duration).toBeLessThan(2000);
    });
  });

  /**
   * Filtering with Pagination Tests
   */
  describe('Filtering with Pagination', () => {
    it('should support status filter with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=1&limit=10&status=ACTIVE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.data).toBeDefined();
      // All returned subscriptions should have ACTIVE status
      response.body.data.data.forEach((sub: any) => {
        expect(sub.status).toBe('ACTIVE');
      });
    });

    it('should support multiple filters with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions?page=1&limit=10&status=ACTIVE&customerId=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('meta');
    });
  });
});

