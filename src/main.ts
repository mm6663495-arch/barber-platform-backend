import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { helmetConfig } from './common/middleware/security.middleware';
import { initSentry } from './config/sentry.config';
import { WinstonLogger } from './config/logger.config';
import { mkdirSync, existsSync } from 'fs';
import { networkInterfaces } from 'os';
import { Request, Response } from 'express';

async function bootstrap() {
  // تهيئة Sentry للـ Error Tracking
  initSentry();

  // إنشاء التطبيق مع Winston Logger
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new WinstonLogger(),
  });

  // إنشاء مجلد logs إذا لم يكن موجوداً
  if (!existsSync('logs')) {
    mkdirSync('logs');
  }

  // Security: Helmet
  app.use(helmetConfig);

  // Serve static files from uploads directory
  // ⚠️ تأكد من أن المسار صحيح - في production يكون dist/uploads
  // استخدام process.cwd() بدلاً من __dirname لضمان المسار الصحيح
  const uploadsPath = join(process.cwd(), 'uploads');
  console.log('📁 [MAIN] Static files path:', uploadsPath);
  console.log('📁 [MAIN] __dirname:', __dirname);
  console.log('📁 [MAIN] process.cwd():', process.cwd());
  console.log('📁 [MAIN] Uploads directory exists:', existsSync(uploadsPath));
  
  // إنشاء مجلد uploads إذا لم يكن موجوداً
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
    console.log('📁 [MAIN] Created uploads directory:', uploadsPath);
  }
  
  // ⚠️ Route handler مخصص لخدمة static files قبل setGlobalPrefix
  // هذا يضمن أن static files لا تتأثر بـ global prefix
  // استخدام Express app مباشرة
  const expressApp = app.getHttpAdapter().getInstance();
  
  expressApp.get('/uploads/:folder/:filename', async (req: Request, res: Response) => {
    try {
      const { folder, filename } = req.params;
      // ⚠️ استخدام process.cwd() لضمان المسار الصحيح
      const filePath = join(process.cwd(), 'uploads', folder, filename);
      
      console.log('📤 [UPLOADS ROUTE] Request received:');
      console.log(`  - Folder: ${folder}`);
      console.log(`  - Filename: ${filename}`);
      console.log(`  - File path: ${filePath}`);
      console.log(`  - File exists: ${existsSync(filePath)}`);
      
      // التحقق من وجود الملف
      if (!existsSync(filePath)) {
        console.log(`❌ [UPLOADS ROUTE] File not found: ${filePath}`);
        return res.status(404).json({
          statusCode: 404,
          message: 'File not found',
          path: `/uploads/${folder}/${filename}`,
        });
      }
      
      console.log(`✅ [UPLOADS ROUTE] File found, sending...`);

      // قراءة الملف وإرساله
      const fs = await import('fs/promises');
      const fileBuffer = await fs.readFile(filePath);
      const ext = filename.split('.').pop()?.toLowerCase();
      
      // تحديد Content-Type
      const contentTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        pdf: 'application/pdf',
        txt: 'text/plain',
      };
      
      const contentType = contentTypes[ext || ''] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // سنة واحدة
      
      console.log(`✅ [UPLOADS ROUTE] File sent successfully: ${filename} (${fileBuffer.length} bytes)`);
      return res.send(fileBuffer);
    } catch (error: any) {
      console.error(`❌ [UPLOADS ROUTE] Error serving file:`, error);
      return res.status(500).json({
        statusCode: 500,
        message: 'Error serving file',
        error: error.message,
      });
    }
  });
  
  console.log('✅ [MAIN] Static files route handler configured at /uploads/:folder/:filename');
  
  // ⚠️ أيضاً استخدام useStaticAssets كـ fallback
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    index: false,
  });
  console.log('✅ [MAIN] useStaticAssets also configured at /uploads/');
  
  // Enable CORS - السماح لجميع الشبكات المحلية
  app.enableCors({
    origin: true, // السماح لجميع النطاقات في بيئة التطوير
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Trust proxy (للحصول على IP الصحيح خلف reverse proxy)
  app.set('trust proxy', true);

  // Global API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', '/health', '/uploads'], // استثناء المسار الرئيسي و health check و static files
  });

  // Global validation pipe
  // ⚠️ ملاحظة: ValidationPipe يتخطى تلقائياً multipart/form-data (file uploads)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // تجاهل multipart/form-data requests (file uploads)
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Barber Platform API')
    .setDescription('API documentation for Barber Platform Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management')
    .addTag('Salons', 'Salon management and packages')
    .addTag('Subscriptions', 'Subscription management')
    .addTag('Payments', 'Payment processing')
    .addTag('Reviews', 'Review and rating system')
    .addTag('Notifications', 'Notification system')
    .addTag('Upload', 'File upload management')
    .addTag('Admin', 'Admin panel and system management')
    .addTag('Security', 'Security and audit logs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // الحصول على المنفذ والـ host من متغيرات البيئة أو استخدام القيم الافتراضية
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0'; // استمع على جميع الواجهات الشبكية (للسماح بالاتصال من الشبكة)

  // الاستماع على جميع الواجهات الشبكية (0.0.0.0) للسماح بالاتصال من أي جهاز على الشبكة
  // ⚠️ مهم: استخدام '0.0.0.0' يسمح بالوصول من جميع الأجهزة على الشبكة المحلية
  // في NestJS، نستخدم app.listen() مباشرة مع host كمعامل ثاني
  await app.listen(port, host);
  
  // التحقق من أن الخادم يعمل على 0.0.0.0
  const httpServer = app.getHttpServer();
  const address = httpServer.address();
  if (address && typeof address === 'object') {
    const actualHost = address.address;
    const actualPort = address.port;
    console.log(`✅ Server is listening on ${actualHost}:${actualPort} (Network accessible)`);
    
    // إذا كان يستمع على localhost فقط، نعرض تحذير
    if (actualHost === '127.0.0.1' || actualHost === '::1') {
      console.warn(`⚠️  Warning: Server is listening on ${actualHost} instead of 0.0.0.0`);
      console.warn(`⚠️  This may prevent network access. Please check server configuration.`);
    }
  } else {
    console.log(`✅ Server is listening on ${host}:${port} (Network accessible)`);
  }

  // عرض معلومات التشغيل
  console.log('');
  console.log('🚀 ===================================');
  console.log('🚀 Barber Platform Backend Started!');
  console.log('🚀 ===================================');
  // الحصول على IP المحلي
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  console.log('');
  console.log(`📍 Local:          http://localhost:${port}`);
  console.log(`📍 Network:        http://${localIP}:${port}`);
  console.log(`📚 API Docs:       http://localhost:${port}/api/docs`);
  console.log('');
  console.log('🔒 Security Features:');
  console.log('   ✅ Helmet Protection');
  console.log('   ✅ CORS Enabled');
  console.log('   ✅ Rate Limiting');
  console.log('   ✅ XSS Protection');
  console.log('   ✅ Input Sanitization');
  console.log('');
  console.log('📝 Logging:');
  console.log('   ✅ Winston Logger');
  console.log('   ✅ Sentry Error Tracking');
  console.log('   ✅ API Request Logging');
  console.log('   ✅ Security Event Logging');
  console.log('');
  console.log('💾 Logs Directory: ./logs/');
  console.log('');
  console.log('🎯 Environment:', process.env.NODE_ENV || 'development');
  console.log('');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
