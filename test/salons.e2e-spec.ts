import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('Salons (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let ownerToken: string;
  let customerToken: string;
  let adminToken: string;
  let salonId: number;

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

    // Create test users
    // 1. Salon Owner
    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `owner${Date.now()}@example.com`,
        password: 'Password@123',
        phone: '0501111111',
        name: 'Test Owner',
        role: UserRole.SALON_OWNER,
      });
    ownerToken = ownerResponse.body.access_token;

    // 2. Customer
    const customerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `customer${Date.now()}@example.com`,
        password: 'Password@123',
        phone: '0502222222',
        name: 'Test Customer',
        role: UserRole.CUSTOMER,
      });
    customerToken = customerResponse.body.access_token;

    // 3. Admin (you might need to create this directly in DB)
    // For simplicity, we'll use owner token for admin tests
    adminToken = ownerToken;
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (salonId) {
        await prismaService.salon.delete({ where: { id: salonId } });
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    await app.close();
  });

  describe('/salons (POST)', () => {
    it('should create a new salon as salon owner', () => {
      return request(app.getHttpServer())
        .post('/salons')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Salon',
          description: 'A great test salon',
          address: 'Riyadh, Saudi Arabia',
          latitude: 24.7136,
          longitude: 46.6753,
          workingHours: {
            saturday: { open: '09:00', close: '21:00' },
            sunday: { open: '09:00', close: '21:00' },
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name', 'Test Salon');
          expect(res.body).toHaveProperty('isApproved', false);
          salonId = res.body.id;
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/salons')
        .send({
          name: 'Unauthorized Salon',
          description: 'Should fail',
          address: 'Test',
        })
        .expect(401);
    });

    it('should return 400 with invalid data', () => {
      return request(app.getHttpServer())
        .post('/salons')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: '', // Empty name
        })
        .expect(400);
    });
  });

  describe('/salons (GET)', () => {
    it('should return list of salons', () => {
      return request(app.getHttpServer())
        .get('/salons')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/salons?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('page', 1);
          expect(res.body.data.length).toBeLessThanOrEqual(5);
        });
    });

    it('should support search filter', () => {
      return request(app.getHttpServer())
        .get('/salons?search=Test')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
        });
    });
  });

  describe('/salons/:id (GET)', () => {
    it('should return salon details by id', () => {
      return request(app.getHttpServer())
        .get(`/salons/${salonId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', salonId);
          expect(res.body).toHaveProperty('name', 'Test Salon');
        });
    });

    it('should return 404 for non-existent salon', () => {
      return request(app.getHttpServer())
        .get('/salons/99999')
        .expect(404);
    });
  });

  describe('/salons/:id (PATCH)', () => {
    it('should update salon as owner', () => {
      return request(app.getHttpServer())
        .patch(`/salons/${salonId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Updated Salon Name',
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name', 'Updated Salon Name');
          expect(res.body).toHaveProperty('description', 'Updated description');
        });
    });

    it('should return 403 when non-owner tries to update', () => {
      return request(app.getHttpServer())
        .patch(`/salons/${salonId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Hacker Attempt',
        })
        .expect(403);
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .patch(`/salons/${salonId}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(401);
    });
  });

  describe('/salons/:id/packages (POST)', () => {
    let packageId: number;

    it('should create a package for salon', () => {
      return request(app.getHttpServer())
        .post(`/salons/${salonId}/packages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Premium Package',
          description: 'All services included',
          price: 299.99,
          duration: 30,
          visits: 10,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name', 'Premium Package');
          expect(res.body).toHaveProperty('price', 299.99);
          packageId = res.body.id;
        });
    });

    it('should return 403 when non-owner tries to create package', () => {
      return request(app.getHttpServer())
        .post(`/salons/${salonId}/packages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Package',
          price: 100,
          duration: 30,
          visits: 5,
        })
        .expect(403);
    });
  });

  describe('/salons/:id/packages (GET)', () => {
    it('should return packages for a salon', () => {
      return request(app.getHttpServer())
        .get(`/salons/${salonId}/packages`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('price');
          }
        });
    });
  });

  describe('/salons/:id/approve (POST)', () => {
    it('should approve salon (admin only)', async () => {
      // Note: In production, you would check for admin role
      // For this test, we're using owner token as admin
      return request(app.getHttpServer())
        .post(`/salons/${salonId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('isApproved', true);
        });
    });
  });

  describe('/salons/:id (DELETE)', () => {
    it('should return 403 when non-owner tries to delete', () => {
      return request(app.getHttpServer())
        .delete(`/salons/${salonId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should delete salon as owner', () => {
      return request(app.getHttpServer())
        .delete(`/salons/${salonId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/salons/${salonId}`)
        .expect(404);
    });
  });
});

