import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { DataSyncService } from '../websocket/services/data-sync.service';

@Injectable()
export class SalonsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    @Inject(forwardRef(() => DataSyncService))
    private dataSyncService?: DataSyncService,
  ) {}

  // Salon Management
  async create(createSalonDto: CreateSalonDto, ownerId: number) {
    // ⭐ التحقق من أن المستخدم لا يملك صالوناً بالفعل
    const existingSalons = await this.prisma.salon.findMany({
      where: { ownerId },
    });

    if (existingSalons.length > 0) {
      throw new ForbiddenException(
        'You already have a salon. Only one salon per owner is allowed.',
      );
    }

    const { name, description, address, latitude, longitude, workingHours, images, logo } = createSalonDto;

    // Logging للتحقق من البيانات المستلمة
    console.log('📝 [SALONS SERVICE] Creating salon with data:');
    console.log('  - ownerId:', ownerId);
    console.log('  - name:', name);
    console.log('  - logo:', logo || 'null');
    console.log('  - images count:', images?.length || 0);
    console.log('  - images:', JSON.stringify(images || [], null, 2));

    const salonData: any = {
        ownerId,
        name,
        description,
        address,
        latitude,
        longitude,
        workingHours: workingHours || {},
        images: images || [],
        isActive: true,
        isApproved: true, // Auto-approve for development/testing
    };

    // ⭐ إضافة logo دائماً (حتى لو كان null أو undefined أو empty string)
    // ملاحظة: الفرونت إند قد يرسل empty string إذا كان logo null
    // لذا نتحقق من null/undefined/empty string ونحفظ null
    if (logo != null && logo !== undefined && typeof logo === 'string' && logo.trim() !== '') {
      salonData.logo = logo.trim(); // إزالة المسافات الزائدة
      console.log('✅ [SALONS SERVICE] Logo will be saved:', salonData.logo);
    } else {
      // إذا كان logo null أو undefined أو empty string، نحفظ null
      salonData.logo = null;
      console.log('⚠️ [SALONS SERVICE] Logo is null/undefined/empty - saving as null');
    }

    console.log('📝 [SALONS SERVICE] Prisma data before create:');
    console.log('  - logo value:', salonData.logo);
    console.log('  - logo type:', typeof salonData.logo);
    console.log('  - logo === null:', salonData.logo === null);
    console.log('  - logo === undefined:', salonData.logo === undefined);
    console.log('  - Full data:', JSON.stringify(salonData, null, 2));

    const createdSalon = await this.prisma.salon.create({
      data: salonData,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        packages: true,
      },
    });

    // Logging للتحقق من البيانات المحفوظة في قاعدة البيانات
    console.log('✅ [SALONS SERVICE] Salon created successfully!');
    console.log('  - id:', createdSalon.id);
    console.log('  - name:', createdSalon.name);
    console.log('  ⭐ logo in DB:', createdSalon.logo);
    console.log('  ⭐ logo === null:', createdSalon.logo === null);
    console.log('  ⭐ logo === undefined:', createdSalon.logo === undefined);
    console.log('  ⭐ logo type:', typeof createdSalon.logo);
    console.log('  ⭐ logo length:', createdSalon.logo?.length || 0);
    console.log('  ⭐ logo is truthy:', !!createdSalon.logo);
    console.log('  - images count:', Array.isArray(createdSalon.images) ? createdSalon.images.length : 0);
    console.log('  - images:', JSON.stringify(createdSalon.images, null, 2));
    
    // ⚠️ تحذير إذا كان logo null رغم أنه يجب أن يكون موجوداً
    if (createdSalon.logo === null || createdSalon.logo === undefined) {
      console.log('⚠️⚠️⚠️ WARNING: Logo is NULL in database!');
      console.log('  - Logo was sent in request:', logo || 'NOT SENT');
      console.log('  - Logo was in salonData:', salonData.logo || 'NOT IN DATA');
    } else {
      console.log('✅✅✅ SUCCESS: Logo saved in database:', createdSalon.logo);
    }

    // ⭐ إرسال حدث مزامنة
    if (this.dataSyncService) {
      await this.dataSyncService.syncSalon(
        createdSalon.id,
        'create',
        {
          name: createdSalon.name,
          isApproved: createdSalon.isApproved,
          isActive: createdSalon.isActive,
        },
        [ownerId],
      );
    }

    return createdSalon;
  }

  async findAll(page = 1, limit = 10, filters?: any) {
    // Use cache for default requests (no filters)
    if (!filters || Object.keys(filters).length === 0) {
      return this.cacheService.wrap(
        this.cacheService.salonsListKey(page, limit),
        async () => this.fetchSalonsList(page, limit, filters),
        300, // 5 minutes
      );
    }
    
    // Don't cache filtered results
    return this.fetchSalonsList(page, limit, filters);
  }

  private async fetchSalonsList(page: number, limit: number, filters?: any) {
    const skip = (page - 1) * limit;
    
    const where: any = {
      isActive: true,
      // مؤقتاً: عرض الصالونات غير المعتمدة أيضاً للتطوير
      // isApproved: true,
    };

    // Apply filters
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { address: { contains: filters.search } },
      ];
    }

    if (filters?.minRating) {
      where.rating = { gte: filters.minRating };
    }

    if (filters?.location) {
      // For location-based search, you might want to implement geospatial queries
      // For now, we'll do a simple text search
      where.address = { contains: filters.location };
    }

    // استخدام raw query مباشرة لتجنب مشاكل JSON parsing في Prisma
    const offset = skip;
    const size = limit;
    
    // بناء WHERE clause
    let whereClause = 'WHERE 1=1'; // بدء من شرط دائماً صحيح
    const queryParams: any[] = [];
    
    // فلترة حسب الحالة
    if (filters?.status) {
      const status = filters.status.toUpperCase();
      console.log(`[SALONS SERVICE] Filtering by status: ${status}`);
      if (status === 'APPROVED') {
        whereClause += ' AND s.isApproved = 1 AND s.isActive = 1';
      } else if (status === 'PENDING') {
        whereClause += ' AND s.isApproved = 0 AND s.isActive = 1';
      } else if (status === 'SUSPENDED') {
        whereClause += ' AND s.isActive = 0';
        console.log('[SALONS SERVICE] Filtering for SUSPENDED salons (isActive = 0)');
      }
    } else {
      // إذا لم يكن هناك فلتر حالة، اعرض فقط الصالونات النشطة (للعامة)
      whereClause += ' AND s.isActive = 1';
    }
    
    console.log(`[SALONS SERVICE] Final WHERE clause: ${whereClause}`);
    
    if (filters?.search) {
      whereClause += ' AND (s.name LIKE ? OR s.description LIKE ? OR s.address LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters?.minRating) {
      whereClause += ' AND s.rating >= ?';
      queryParams.push(filters.minRating);
    }
    
    if (filters?.location) {
      whereClause += ' AND s.address LIKE ?';
      queryParams.push(`%${filters.location}%`);
    }
    
    try {
      // استعلام لجلب الصالونات
      const salonsRaw = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id,
          s.ownerId,
          s.name,
          s.logo,
          s.description,
          s.address,
          s.latitude,
          s.longitude,
          -- نظّف JSON: إن كان غير صالح/NULL أعد افتراضيات سليمة
          CASE WHEN JSON_VALID(s.workingHours) THEN s.workingHours ELSE JSON_OBJECT() END AS workingHours,
          CASE WHEN JSON_VALID(s.images) THEN s.images ELSE JSON_ARRAY() END AS images,
          s.rating,
          s.totalReviews,
          s.isActive,
          s.isApproved,
          s.createdAt,
          s.updatedAt,
          -- بيانات المالك
          so.id AS owner_id,
          so.fullName AS owner_fullName,
          so.phone AS owner_phone,
          u.id AS owner_user_id,
          u.email AS owner_user_email
        FROM \`Salon\` s
        LEFT JOIN \`SalonOwner\` so ON s.ownerId = so.id
        LEFT JOIN \`User\` u ON so.userId = u.id
        ${whereClause}
        ORDER BY s.rating DESC
        LIMIT ? OFFSET ?
        `,
        ...queryParams,
        size,
        offset,
      );

      // استعلام لجلب العدد الكلي
      const countQuery = `SELECT COUNT(*) as total FROM \`Salon\` s ${whereClause}`;
      const countRows = await this.prisma.$queryRawUnsafe<any[]>(
        countQuery,
        ...queryParams,
      );
      const total = Number(countRows?.[0]?.total ?? 0);
      
      console.log(`[SALONS SERVICE] Query result: ${salonsRaw?.length || 0} salons found, total: ${total}`);
      if (salonsRaw && salonsRaw.length > 0) {
        console.log(`[SALONS SERVICE] First salon isActive: ${salonsRaw[0]?.isActive}, isApproved: ${salonsRaw[0]?.isApproved}`);
      }

      // حارس JSON لتجنب انهيار الاستجابة بسبب بيانات JSON تالفة
      const safeJson = <T>(value: any, fallback: T): T => {
        try {
          if (value === null || value === undefined) return fallback;
          if (typeof value === 'string') {
            if (value.trim() === '' || value === 'null' || value === 'undefined') return fallback;
            return JSON.parse(value);
          }
          return value;
        } catch (error) {
          console.warn('[SALONS SERVICE] JSON parse error, using fallback:', error);
          return fallback;
        }
      };

      // جلب الباقات لكل صالون بشكل منفصل لتجنب مشاكل JSON
      const salons = await Promise.all((Array.isArray(salonsRaw) ? salonsRaw : []).map(async (s: any) => {
        try {
          // جلب الباقات بشكل منفصل
          let packages: any[] = [];
          try {
            const salonPackages = await this.prisma.package.findMany({
              where: {
                salonId: s.id,
                isActive: true,
                isPublished: true,
              },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                visitsCount: true,
                validityDays: true,
                isActive: true,
                isPublished: true,
                // تجنب جلب services و images من Prisma مباشرة
              },
            });
            packages = salonPackages.map((p: any) => ({
              ...p,
              services: [],
              images: [],
            }));
          } catch (pkgError) {
            console.warn(`[SALONS SERVICE] Error loading packages for salon ${s.id}:`, pkgError);
            packages = [];
          }

          // بناء كائن المالك
          const owner = s.owner_id ? {
            id: s.owner_id,
            fullName: s.owner_fullName || null,
            phone: s.owner_phone || null,
            user: s.owner_user_id ? {
              id: s.owner_user_id,
              email: s.owner_user_email || null,
            } : null,
          } : null;

          return {
            id: Number(s.id),
            ownerId: Number(s.ownerId),
            name: s.name,
            logo: s.logo,
            description: s.description,
            address: s.address,
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
            workingHours: safeJson(s?.workingHours, {}),
            images: safeJson(s?.images, []),
            rating: Number(s.rating) || 0,
            totalReviews: Number(s.totalReviews) || 0,
            isActive: s.isActive === 1 || s.isActive === true,
            isApproved: s.isApproved === 1 || s.isApproved === true,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            owner,
            packages,
            _count: {
              reviews: 0, // سيتم حسابه لاحقاً إذا لزم الأمر
            },
          };
        } catch (error) {
          console.error('[SALONS SERVICE] Error processing salon, using minimal data:', error);
          // إرجاع بيانات أساسية فقط في حالة الخطأ
          return {
            id: Number(s?.id),
            name: s?.name || 'Unknown Salon',
            owner: s.owner_id ? {
              id: Number(s.owner_id),
              fullName: s.owner_fullName || null,
              phone: s.owner_phone || null,
              user: s.owner_user_id ? {
                id: Number(s.owner_user_id),
                email: s.owner_user_email || null,
              } : null,
            } : null,
            packages: [],
            workingHours: {},
            images: [],
            rating: Number(s?.rating) || 0,
            totalReviews: Number(s?.totalReviews) || 0,
            isActive: s?.isActive === 1 || s?.isActive === true,
            isApproved: s?.isApproved === 1 || s?.isApproved === true,
          };
        }
      }));

      return {
        salons,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      console.error('[SALONS SERVICE] Error in fetchSalonsList, using fallback:', err);
      // Fallback: استعلام خام يُنظّف JSON على مستوى SQL لتفادي خطأ Prisma JSON parse
      const offset = skip;
      const size = limit;
      // ملاحظة: الأسماء الافتراضية للجدول حسب Prisma تكون Case-Sensitive بحسب إعدادات MySQL/FS
      // استخدم أسماء الحقول كما في schema.prisma
      const salonsRaw = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id,
          s.ownerId,
          s.name,
          s.logo,
          s.description,
          s.address,
          s.latitude,
          s.longitude,
          -- نظّف JSON: إن كان غير صالح/NULL أعد افتراضيات سليمة كنص
          CASE WHEN JSON_VALID(s.workingHours) THEN s.workingHours ELSE JSON_OBJECT() END AS workingHours,
          CASE WHEN JSON_VALID(s.images) THEN s.images ELSE JSON_ARRAY() END       AS images,
          s.rating,
          s.totalReviews,
          s.isActive,
          s.isApproved,
          s.createdAt,
          s.updatedAt,
          -- بيانات المالك
          so.id AS owner_id,
          so.fullName AS owner_fullName,
          so.phone AS owner_phone,
          u.id AS owner_user_id,
          u.email AS owner_user_email
        FROM \`Salon\` s
        LEFT JOIN \`SalonOwner\` so ON s.ownerId = so.id
        LEFT JOIN \`User\` u ON so.userId = u.id
        ${whereClause}
        ORDER BY s.rating DESC
        LIMIT ? OFFSET ?
        `,
        ...queryParams,
        size,
        offset,
      );

      const countRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as total FROM \`Salon\` s ${whereClause}`,
        ...queryParams,
      );
      const total = Number(countRows?.[0]?.total ?? 0);

      const parseJson = <T>(text: any, fallback: T): T => {
        try {
          if (text === null || text === undefined) return fallback;
          if (typeof text === 'string') {
            if (text.trim() === '' || text === 'null' || text === 'undefined') return fallback;
            return JSON.parse(text);
          }
          return text;
        } catch (error) {
          console.warn('[SALONS SERVICE] Fallback JSON parse error, using fallback:', error);
          return fallback;
        }
      };

      const salons = (salonsRaw || []).map((s: any) => {
        try {
          return {
            ...s,
            workingHours: parseJson(s?.workingHours, {}),
            images: parseJson(s?.images, []),
            // في المسار الاحتياطي لا نعيد packages لتقليل التعقيد/الأخطاء
            packages: [],
            // إضافة بيانات المالك
            owner: s.owner_id ? {
              id: s.owner_id,
              fullName: s.owner_fullName || null,
              phone: s.owner_phone || null,
              user: s.owner_user_id ? {
                id: s.owner_user_id,
                email: s.owner_user_email || null,
              } : null,
            } : null,
          };
        } catch (error) {
          console.error('[SALONS SERVICE] Error in fallback mapping, using minimal data:', error);
          return {
            id: s?.id,
            name: s?.name || 'Unknown Salon',
            owner: s.owner_id ? {
              id: s.owner_id,
              fullName: s.owner_fullName || null,
              phone: s.owner_phone || null,
              user: s.owner_user_id ? {
                id: s.owner_user_id,
                email: s.owner_user_email || null,
              } : null,
            } : null,
            packages: [],
            workingHours: {},
            images: [],
            rating: s?.rating || 0,
            totalReviews: s?.totalReviews || 0,
            isActive: s?.isActive ?? true,
            isApproved: s?.isApproved ?? false,
          };
        }
      });

      return {
        salons,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }
  }


  async findOne(id: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        packages: {
          where: { isActive: true, isPublished: true },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: {
                fullName: true,
                profileImage: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            visits: true,
            packages: true, // ⭐ إضافة packages count للإحصائيات
          },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    return salon;
  }

  async findByOwner(ownerId: number) {
    try {
      // ⭐ تحسين الاستعلام لتقليل البيانات المعادة وتحسين الأداء
      const salons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          latitude: true,
          longitude: true,
          logo: true,
          images: true,
          workingHours: true,
          rating: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
          updatedAt: true,
          ownerId: true,
          packages: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              visitsCount: true,
              validityDays: true,
              isActive: true,
              isPublished: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              visits: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return salons;
    } catch (error) {
      console.error('[SALONS SERVICE] Error in findByOwner:', error);
      throw error;
    }
  }

  async update(id: number, updateSalonDto: UpdateSalonDto, ownerId: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only update your own salon');
    }

    return this.updateByAdmin(id, updateSalonDto);
  }

  async updateByAdmin(id: number, updateSalonDto: UpdateSalonDto) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    // ⭐ معالجة logo بشكل صحيح (مثل create)
    const updateData: any = { ...updateSalonDto };
    
    // ⭐ إضافة logo دائماً (حتى لو كان null أو undefined أو empty string)
    if (updateSalonDto.logo !== undefined) {
      if (updateSalonDto.logo != null && typeof updateSalonDto.logo === 'string' && updateSalonDto.logo.trim() !== '') {
        updateData.logo = updateSalonDto.logo.trim(); // إزالة المسافات الزائدة
        console.log('✅ [SALONS SERVICE] Logo will be updated:', updateData.logo);
      } else {
        // إذا كان logo null أو undefined أو empty string، نحفظ null
        updateData.logo = null;
        console.log('⚠️ [SALONS SERVICE] Logo is null/undefined/empty - saving as null');
      }
    }

    // ⭐ معالجة images بشكل صحيح (مثل create)
    if (updateSalonDto.images !== undefined) {
      updateData.images = Array.isArray(updateSalonDto.images) 
        ? updateSalonDto.images 
        : [];
    }

    console.log('📝 [SALONS SERVICE] Updating salon with data:');
    console.log('  - id:', id);
    console.log('  - logo value:', updateData.logo);
    console.log('  - logo type:', typeof updateData.logo);
    console.log('  - logo === null:', updateData.logo === null);
    console.log('  - logo === undefined:', updateData.logo === undefined);

    const updatedSalon = await this.prisma.salon.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
          },
        },
        packages: true,
      },
    });

    // Logging للتحقق من البيانات المحفوظة في قاعدة البيانات
    console.log('✅ [SALONS SERVICE] Salon updated successfully!');
    console.log('  - id:', updatedSalon.id);
    console.log('  - name:', updatedSalon.name);
    console.log('  ⭐ logo in DB:', updatedSalon.logo);
    console.log('  ⭐ logo === null:', updatedSalon.logo === null);
    console.log('  ⭐ logo === undefined:', updatedSalon.logo === undefined);
    console.log('  ⭐ logo type:', typeof updatedSalon.logo);
    console.log('  ⭐ logo length:', updatedSalon.logo?.length || 0);
    console.log('  ⭐ logo is truthy:', !!updatedSalon.logo);

    // ⭐ إبطال الكاش بعد التحديث
    await this.cacheService.invalidateSalonCache(id);

    return updatedSalon;
  }

  async remove(id: number, ownerId: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only delete your own salon');
    }

    return this.prisma.salon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async approveSalon(id: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    return this.prisma.salon.update({
      where: { id },
      data: { isApproved: true },
    });
  }

  async rejectSalon(id: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    return this.prisma.salon.update({
      where: { id },
      data: { isApproved: false, isActive: false },
    });
  }

  async suspendSalon(id: number, reason?: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    return this.prisma.salon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateSalon(id: number) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    // تفعيل الصالون وجعله معلق (PENDING) - نشط لكن غير معتمد
    return this.prisma.salon.update({
      where: { id },
      data: { 
        isActive: true,
        isApproved: false, // جعله معلق للمراجعة
      },
    });
  }

  // Package Management
  async createPackage(salonId: number, createPackageDto: CreatePackageDto, ownerId: number) {
    // Verify salon ownership
    const salon = await this.prisma.salon.findFirst({
      where: { id: salonId, ownerId },
    });

    if (!salon) {
      throw new ForbiddenException('You can only create packages for your own salon');
    }

    // Logging للتحقق من البيانات المستلمة
    console.log('📥 [SALONS SERVICE] Received create package request:');
    console.log('  - Salon ID:', salonId);
    console.log('  - Create DTO:', JSON.stringify(createPackageDto, null, 2));
    console.log('  - Services:', createPackageDto.services || []);
    console.log('  - Images:', createPackageDto.images || []);

    // إعداد البيانات مع التأكد من أن services و images هي arrays
    const packageData: any = {
        salonId,
      name: createPackageDto.name,
      description: createPackageDto.description,
      price: createPackageDto.price,
      visitsCount: createPackageDto.visitsCount,
      validityDays: createPackageDto.validityDays,
      services: Array.isArray(createPackageDto.services) ? createPackageDto.services : [],
      images: Array.isArray(createPackageDto.images) ? createPackageDto.images : [],
      isActive: createPackageDto.isActive ?? true,
      isPublished: createPackageDto.isPublished ?? false,
    };

    console.log('📤 [SALONS SERVICE] Creating package with data:', JSON.stringify(packageData, null, 2));

    const createdPackage = await this.prisma.package.create({
      data: packageData,
    });

    console.log('✅ [SALONS SERVICE] Package created successfully:', createdPackage.id);
    
    // جلب الباقة المحدثة مع services و images
    const packageWithRelations = await this.prisma.package.findUnique({
      where: { id: createdPackage.id },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    }) as any;

    console.log('✅ [SALONS SERVICE] Services saved:', packageWithRelations?.services);
    console.log('✅ [SALONS SERVICE] Images saved:', packageWithRelations?.images);

    return (packageWithRelations || createdPackage) as any;
  }

  async findPackages(salonId: number) {
    let packages: any[];
    
    try {
      // Try to fetch with full includes first
      packages = await this.prisma.package.findMany({
        where: { salonId, isActive: true },
        include: {
          subscriptions: {
            where: {
              status: 'ACTIVE',
            },
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      // If JSON parsing fails, use safe select instead of include
      if (error.message?.includes('JSON') || error.message?.includes('SyntaxError')) {
        console.warn('⚠️ JSON parsing error in findPackages, using safe select');
        packages = await this.prisma.package.findMany({
          where: { salonId, isActive: true },
          select: {
            id: true,
            salonId: true,
            name: true,
            description: true,
            price: true,
            visitsCount: true,
            validityDays: true,
            isActive: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        
        // Add safe JSON parsing for images and services
        packages = packages.map((pkg: any) => ({
          ...pkg,
          images: [],
          services: [],
          subscriptions: [],
        }));
      } else {
        throw error;
      }
    }

    // Safe JSON parsing utility
    const safeJson = <T>(value: any, fallback: T): T => {
      try {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return fallback;
          }
        }
        return value;
      } catch {
        return fallback;
      }
    };

    // Process packages to ensure safe JSON fields
    const safePackages = packages.map((pkg: any) => {
      const hasImages = 'images' in pkg;
      const hasServices = 'services' in pkg;
      
      return {
        ...pkg,
        images: hasImages 
          ? safeJson(pkg.images, Array.isArray(pkg.images) ? pkg.images : [])
          : [],
        services: hasServices
          ? safeJson(pkg.services, Array.isArray(pkg.services) ? pkg.services : [])
          : [],
      };
    });

    // Logging للتحقق من البيانات المرسلة
    console.log('📤 [SALONS SERVICE] Returning packages:');
    console.log('  - Packages count:', safePackages.length);
    if (safePackages.length > 0) {
      const firstPackage = safePackages[0] as any;
      console.log('  - First package name:', firstPackage.name);
      console.log('  - First package images:', firstPackage.images);
      console.log('  - First package images type:', typeof firstPackage.images);
      console.log('  - First package images isArray:', Array.isArray(firstPackage.images));
      console.log('  - First package services:', firstPackage.services);
      console.log('  - First package services type:', typeof firstPackage.services);
      console.log('  - First package services isArray:', Array.isArray(firstPackage.services));
    }

    return safePackages;
  }

  async findPackage(id: number) {
    const packageData = await this.prisma.package.findUnique({
      where: { id },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    return packageData;
  }

  async updatePackage(id: number, updatePackageDto: UpdatePackageDto, ownerId: number) {
    // Logging للتحقق من البيانات المستلمة
    console.log('📥 [SALONS SERVICE] Received update package request:');
    console.log('  - Package ID:', id);
    console.log('  - Update DTO:', JSON.stringify(updatePackageDto, null, 2));

    const packageData = await this.prisma.package.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    if (packageData.salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only update packages for your own salon');
    }

    // تحويل services و images إلى JSON إذا كانت موجودة
    const updateData: any = {};
    
    // إضافة الحقول الأساسية
    if (updatePackageDto.name !== undefined) updateData.name = updatePackageDto.name;
    if (updatePackageDto.description !== undefined) updateData.description = updatePackageDto.description;
    if (updatePackageDto.price !== undefined) updateData.price = updatePackageDto.price;
    if (updatePackageDto.visitsCount !== undefined) updateData.visitsCount = updatePackageDto.visitsCount;
    if (updatePackageDto.validityDays !== undefined) updateData.validityDays = updatePackageDto.validityDays;
    if (updatePackageDto.isActive !== undefined) updateData.isActive = updatePackageDto.isActive;
    if (updatePackageDto.isPublished !== undefined) updateData.isPublished = updatePackageDto.isPublished;
    
    // تحويل services و images إلى JSON (Prisma يتوقع JSON)
    // يجب أن تكون arrays أو objects، وليس undefined
    if (updatePackageDto.services !== undefined) {
      updateData.services = Array.isArray(updatePackageDto.services) 
        ? updatePackageDto.services 
        : [];
    }
    if (updatePackageDto.images !== undefined) {
      updateData.images = Array.isArray(updatePackageDto.images) 
        ? updatePackageDto.images 
        : [];
    }

    console.log('📤 [SALONS SERVICE] Updating package with data:', JSON.stringify(updateData, null, 2));
    console.log('📤 [SALONS SERVICE] Services type:', typeof updateData.services, Array.isArray(updateData.services));
    console.log('📤 [SALONS SERVICE] Images type:', typeof updateData.images, Array.isArray(updateData.images));

    try {
      const updatedPackage = await this.prisma.package.update({
      where: { id },
        data: updateData,
        include: {
          salon: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
          },
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
      });

      console.log('✅ [SALONS SERVICE] Package updated successfully:', updatedPackage.id);
      return updatedPackage;
    } catch (error) {
      console.error('❌ [SALONS SERVICE] Error updating package:', error);
      console.error('❌ [SALONS SERVICE] Update data:', JSON.stringify(updateData, null, 2));
      throw error;
    }
  }

  async removePackage(id: number, ownerId: number) {
    const packageData = await this.prisma.package.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    if (packageData.salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only delete packages for your own salon');
    }

    return this.prisma.package.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async publishPackage(id: number, ownerId: number) {
    const packageData = await this.prisma.package.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    if (packageData.salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only publish packages for your own salon');
    }

    return this.prisma.package.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  async unpublishPackage(id: number, ownerId: number) {
    const packageData = await this.prisma.package.findUnique({
      where: { id },
      include: {
        salon: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Package not found');
    }

    if (packageData.salon.ownerId !== ownerId) {
      throw new ForbiddenException('You can only unpublish packages for your own salon');
    }

    return this.prisma.package.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  // Statistics - إحصائيات جميع صالونات المالك
  async getSalonStatistics(ownerId: number) {
    const salons = await this.prisma.salon.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: {
            packages: true,
            reviews: true,
            visits: true,
          },
        },
      },
    });

    const totalSalons = salons.length;
    const totalPackages = salons.reduce((sum, salon) => sum + salon._count.packages, 0);
    const totalReviews = salons.reduce((sum, salon) => sum + salon._count.reviews, 0);
    
    // ⭐ حساب الزيارات بدون الزيارات الملغية
    const totalVisits = await this.prisma.visit.count({
      where: {
        salonId: { in: salons.map((s) => s.id) },
        status: { not: 'CANCELLED' },
      },
    });

    return {
      totalSalons,
      totalPackages,
      totalReviews,
      totalVisits,
      salons,
    };
  }

  // إحصائيات صالون واحد محدد - محسّنة ودقيقة
  async getSingleSalonStatistics(salonId: number, ownerId: number) {
    // التحقق من أن الصالون يخص المالك
    const salon = await this.prisma.salon.findFirst({
      where: {
        id: salonId,
        ownerId,
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found or access denied');
    }

    // حساب الإحصائيات بشكل دقيق ومحترف
    const [
      packagesCount,
      activePackagesCount,
      publishedPackagesCount,
      visitsCount,
      todayVisitsCount,
      thisWeekVisitsCount,
      thisMonthVisitsCount,
      reviewsCount,
      averageRating,
      activeSubscriptionsCount,
      totalSubscriptionsCount,
      totalRevenue,
      thisMonthRevenue,
    ] = await Promise.all([
      // عدد الباقات
      this.prisma.package.count({
        where: { salonId },
      }),
      // عدد الباقات النشطة
      this.prisma.package.count({
        where: { salonId, isActive: true },
      }),
      // عدد الباقات المنشورة
      this.prisma.package.count({
        where: { salonId, isActive: true, isPublished: true },
      }),
      // ⭐ إجمالي الزيارات (بدون الزيارات الملغية)
      this.prisma.visit.count({
        where: {
          salonId,
          status: { not: 'CANCELLED' },
        },
      }),
      // ⭐ زيارات اليوم (بدون الزيارات الملغية)
      (() => {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        return this.prisma.visit.count({
          where: {
            salonId,
            status: { not: 'CANCELLED' },
            visitDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });
      })(),
      // ⭐ زيارات هذا الأسبوع (بدون الزيارات الملغية)
      (() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // الأحد
        startOfWeek.setHours(0, 0, 0, 0);
        return this.prisma.visit.count({
          where: {
            salonId,
            status: { not: 'CANCELLED' },
            visitDate: {
              gte: startOfWeek,
            },
          },
        });
      })(),
      // ⭐ زيارات هذا الشهر (بدون الزيارات الملغية)
      (() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        return this.prisma.visit.count({
          where: {
            salonId,
            status: { not: 'CANCELLED' },
            visitDate: {
              gte: startOfMonth,
            },
          },
        });
      })(),
      // عدد التقييمات
      this.prisma.review.count({
        where: { salonId },
      }),
      // متوسط التقييم (من قاعدة البيانات أو من الحساب)
      Promise.resolve(salon.rating || 0),
      // الاشتراكات النشطة
      this.prisma.subscription.count({
        where: {
          package: { salonId },
          status: 'ACTIVE',
        },
      }),
      // إجمالي الاشتراكات
      this.prisma.subscription.count({
        where: {
          package: { salonId },
        },
      }),
      // إجمالي الإيرادات (من المدفوعات)
      this.prisma.payment.aggregate({
        where: {
          subscription: {
            package: { salonId },
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }).then((result) => result._sum.amount || 0),
      // إيرادات هذا الشهر (من بداية الشهر)
      (() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        return this.prisma.payment.aggregate({
          where: {
            subscription: {
              package: { salonId },
            },
            status: 'COMPLETED',
            createdAt: {
              gte: startOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        }).then((result) => result._sum.amount || 0);
      })(),
    ]);

    // حساب عدد العملاء الفريدين
    const uniqueCustomersCount = await this.prisma.customer.count({
      where: {
        subscriptions: {
          some: {
            package: { salonId },
          },
        },
      },
    });

    return {
      // إحصائيات الباقات
      packages: {
        total: packagesCount,
        active: activePackagesCount,
        published: publishedPackagesCount,
      },
      // إحصائيات الزيارات
      visits: {
        total: visitsCount,
        today: todayVisitsCount,
        thisWeek: thisWeekVisitsCount,
        thisMonth: thisMonthVisitsCount,
      },
      // إحصائيات التقييمات
      reviews: {
        total: reviewsCount,
        averageRating: averageRating,
      },
      // إحصائيات الاشتراكات
      subscriptions: {
        total: totalSubscriptionsCount,
        active: activeSubscriptionsCount,
      },
      // إحصائيات العملاء
      customers: {
        unique: uniqueCustomersCount,
      },
      // إحصائيات الإيرادات
      revenue: {
        total: totalRevenue,
        thisMonth: thisMonthRevenue,
      },
      // التقييم المتوسط (من الصالون)
      rating: averageRating,
    };
  }

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    page: number = 1,
    limit: number = 10,
  ) {
    // حساب مربع الحدود للبحث السريع
    const latDelta = radiusKm / 111; // 1 درجة = ~111 كم
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;

    const skip = (page - 1) * limit;

    // استخدام raw query للحصول على الصالونات القريبة
    const salonsRaw = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        s.id,
        s.ownerId,
        s.name,
        s.logo,
        s.description,
        s.address,
        s.latitude,
        s.longitude,
        CASE WHEN JSON_VALID(s.workingHours) THEN s.workingHours ELSE JSON_OBJECT() END AS workingHours,
        CASE WHEN JSON_VALID(s.images) THEN s.images ELSE JSON_ARRAY() END AS images,
        s.rating,
        s.totalReviews,
        s.isActive,
        s.isApproved,
        s.createdAt,
        s.updatedAt,
        so.id AS owner_id,
        so.fullName AS owner_fullName,
        so.phone AS owner_phone,
        u.id AS owner_user_id,
        u.email AS owner_user_email,
        (
          6371 * acos(
            cos(radians(?)) * cos(radians(s.latitude)) *
            cos(radians(s.longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(s.latitude))
          )
        ) AS distance
      FROM \`Salon\` s
      LEFT JOIN \`SalonOwner\` so ON s.ownerId = so.id
      LEFT JOIN \`User\` u ON so.userId = u.id
      WHERE s.isActive = 1 
        AND s.isApproved = 1
        AND s.latitude BETWEEN ? AND ?
        AND s.longitude BETWEEN ? AND ?
      HAVING distance <= ?
      ORDER BY distance ASC
      LIMIT ? OFFSET ?
      `,
      latitude,
      longitude,
      latitude,
      minLat,
      maxLat,
      minLon,
      maxLon,
      radiusKm,
      limit,
      skip,
    );

    const parseJson = <T>(text: any, fallback: T): T => {
      try {
        if (text === null || text === undefined) return fallback;
        if (typeof text === 'string') {
          if (text.trim() === '' || text === 'null' || text === 'undefined') return fallback;
          return JSON.parse(text);
        }
        return text;
      } catch (error) {
        return fallback;
      }
    };

    const salons = (salonsRaw || []).map((s: any) => ({
      ...s,
      workingHours: parseJson(s?.workingHours, {}),
      images: parseJson(s?.images, []),
      packages: [],
      owner: s.owner_id ? {
        id: s.owner_id,
        fullName: s.owner_fullName || null,
        phone: s.owner_phone || null,
        user: s.owner_user_id ? {
          id: s.owner_user_id,
          email: s.owner_user_email || null,
        } : null,
      } : null,
      distance: Number(s.distance) || 0,
    }));

    // Get total count
    const countRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*) as total
      FROM (
        SELECT
          s.id,
          (
            6371 * acos(
              cos(radians(?)) * cos(radians(s.latitude)) *
              cos(radians(s.longitude) - radians(?)) +
              sin(radians(?)) * sin(radians(s.latitude))
            )
          ) AS distance
        FROM \`Salon\` s
        WHERE s.isActive = 1 
          AND s.isApproved = 1
          AND s.latitude BETWEEN ? AND ?
          AND s.longitude BETWEEN ? AND ?
        HAVING distance <= ?
      ) AS nearby_salons
      `,
      latitude,
      longitude,
      latitude,
      minLat,
      maxLat,
      minLon,
      maxLon,
      radiusKm,
    );

    const total = Number(countRows?.[0]?.total ?? 0);

    return {
      success: true,
      data: salons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPopularSalons(limit = 10) {
    return this.prisma.salon.findMany({
      where: {
        isActive: true,
        isApproved: true,
      },
      include: {
        owner: {
          select: {
            fullName: true,
          },
        },
        _count: {
          select: {
            reviews: true,
            visits: true,
          },
        },
      },
      orderBy: [
        { rating: 'desc' },
        { totalReviews: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * الحصول على إحصائيات شاملة لصالون المالك الحالي
   */
  async getMyStatistics(userId: number, period: string = 'month') {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      include: {
        packages: {
          include: {
            subscriptions: {
              include: {
                visits: true,
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found for this user');
    }

    // حساب الفترة الزمنية
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // إحصائيات الاشتراكات
    const allSubscriptions = salon.packages.flatMap((pkg) => pkg.subscriptions);
    const periodSubscriptions = allSubscriptions.filter(
      (sub) => new Date(sub.createdAt) >= startDate,
    );

    // إحصائيات الزيارات
    const allVisits = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.visits),
    );
    const periodVisits = allVisits.filter(
      (visit) => new Date(visit.visitDate) >= startDate,
    );

    // إحصائيات المدفوعات
    const allPayments = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.payments),
    );
    const periodPayments = allPayments.filter(
      (payment) => new Date(payment.createdAt) >= startDate,
    );

    // إجمالي الإيرادات
    const totalRevenue = periodPayments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // إحصائيات العملاء
    const uniqueCustomers = new Set(
      allSubscriptions.map((sub) => sub.customerId),
    ).size;

    // إحصائيات الباقات
    const activePackages = salon.packages.filter((pkg) => pkg.isActive).length;

    // متوسط التقييم
    const reviews = await this.prisma.review.findMany({
      where: { salonId: salon.id },
    });
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      overview: {
        totalCustomers: uniqueCustomers,
        totalSubscriptions: allSubscriptions.length,
        periodSubscriptions: periodSubscriptions.length,
        totalVisits: allVisits.length,
        periodVisits: periodVisits.length,
        totalPackages: salon.packages.length,
        activePackages,
        totalRevenue: Number(totalRevenue),
        averageRating: Number(averageRating.toFixed(2)),
        totalReviews: reviews.length,
      },
      period,
      periodStart: startDate,
      periodEnd: now,
    };
  }

  /**
   * الحصول على التحليلات المالية للصالون
   */
  async getMyFinancialAnalytics(
    userId: number,
    startDate?: string,
    endDate?: string,
    period: string = 'monthly',
  ) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      include: {
        packages: {
          include: {
            subscriptions: {
              include: {
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found for this user');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // جمع جميع المدفوعات
    const allPayments = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.payments),
    );

    const periodPayments = allPayments.filter(
      (payment) =>
        new Date(payment.createdAt) >= start &&
        new Date(payment.createdAt) <= end &&
        payment.status === 'COMPLETED',
    );

    // إجمالي الإيرادات
    const totalRevenue = periodPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    // تجميع الإيرادات حسب الفترة
    const revenueByPeriod = this.groupRevenueByPeriod(
      periodPayments,
      period,
    );

    // إحصائيات المدفوعات
    const paymentStats = {
      total: periodPayments.length,
      completed: periodPayments.filter((p) => p.status === 'COMPLETED').length,
      pending: periodPayments.filter((p) => p.status === 'PENDING').length,
      failed: periodPayments.filter((p) => p.status === 'FAILED').length,
    };

    // متوسط قيمة المدفوعات
    const averagePayment =
      periodPayments.length > 0
        ? totalRevenue / periodPayments.length
        : 0;

    return {
      totalRevenue: Number(totalRevenue),
      averagePayment: Number(averagePayment.toFixed(2)),
      paymentStats,
      revenueByPeriod,
      period,
      startDate: start,
      endDate: end,
    };
  }

  /**
   * تجميع الإيرادات حسب الفترة
   */
  private groupRevenueByPeriod(payments: any[], period: string) {
    const groups: Record<string, { revenue: number; count: number }> = {};

    payments.forEach((payment) => {
      const date = new Date(payment.createdAt);
      let key: string;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groups[key]) {
        groups[key] = { revenue: 0, count: 0 };
      }

      groups[key].revenue += Number(payment.amount);
      groups[key].count += 1;
    });

    return Object.entries(groups)
      .map(([key, value]) => ({
        period: key,
        revenue: Number(value.revenue),
        count: value.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * الحصول على تقارير الأداء للصالون
   */
  async getMyPerformanceReports(
    userId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      include: {
        packages: {
          include: {
            subscriptions: {
              include: {
                visits: {
                  include: {
                    review: true,
                  },
                },
              },
            },
          },
        },
        reviews: true,
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found for this user');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // إحصائيات الزيارات
    const allVisits = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.visits),
    );
    const periodVisits = allVisits.filter(
      (visit) =>
        new Date(visit.visitDate) >= start && new Date(visit.visitDate) <= end,
    );

    // إحصائيات الباقات
    const packagePerformance = salon.packages.map((pkg) => {
      const pkgSubscriptions = pkg.subscriptions;
      const pkgVisits = pkgSubscriptions.flatMap((sub) => sub.visits);
      const periodPkgVisits = pkgVisits.filter(
        (visit) =>
          new Date(visit.visitDate) >= start &&
          new Date(visit.visitDate) <= end,
      );

      return {
        packageId: pkg.id,
        packageName: pkg.name,
        totalSubscriptions: pkgSubscriptions.length,
        totalVisits: pkgVisits.length,
        periodVisits: periodPkgVisits.length,
        completedVisits: periodPkgVisits.filter(
          (v) => v.status === 'COMPLETED',
        ).length,
        averageRating:
          pkgVisits
            .map((v) => v.review?.rating ?? 0)
            .filter((r) => r > 0)
            .reduce((sum, r, _, arr) => sum + r / arr.length, 0) || 0,
      };
    });

    // إحصائيات التقييمات
    const periodReviews = salon.reviews.filter(
      (review) =>
        new Date(review.createdAt) >= start &&
        new Date(review.createdAt) <= end,
    );

    const averageRating =
      salon.reviews.length > 0
        ? salon.reviews.reduce((sum, r) => sum + r.rating, 0) /
          salon.reviews.length
        : 0;

    // معدل إتمام الزيارات
    const completionRate =
      periodVisits.length > 0
        ? (periodVisits.filter((v) => v.status === 'COMPLETED').length /
            periodVisits.length) *
          100
        : 0;

    return {
      overview: {
        totalVisits: periodVisits.length,
        completedVisits: periodVisits.filter(
          (v) => v.status === 'COMPLETED',
        ).length,
        completionRate: Number(completionRate.toFixed(2)),
        totalReviews: periodReviews.length,
        averageRating: Number(averageRating.toFixed(2)),
      },
      packagePerformance,
      startDate: start,
      endDate: end,
    };
  }

  /**
   * الحصول على المقارنات الزمنية للصالون
   */
  async getMyTimeComparisons(userId: number, period: string = 'month') {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      include: {
        packages: {
          include: {
            subscriptions: {
              include: {
                visits: true,
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found for this user');
    }

    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;

    switch (period) {
      case 'week':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(
          currentStart.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        break;
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), quarter * 3, 1);
        previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        break;
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        break;
      default:
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const currentEnd = now;
    const previousEnd = currentStart;

    // جمع البيانات للفترة الحالية
    const allVisits = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.visits),
    );
    const allPayments = salon.packages.flatMap((pkg) =>
      pkg.subscriptions.flatMap((sub) => sub.payments),
    );

    const currentVisits = allVisits.filter(
      (visit) =>
        new Date(visit.visitDate) >= currentStart &&
        new Date(visit.visitDate) <= currentEnd,
    );
    const previousVisits = allVisits.filter(
      (visit) =>
        new Date(visit.visitDate) >= previousStart &&
        new Date(visit.visitDate) < previousEnd,
    );

    const currentPayments = allPayments.filter(
      (payment) =>
        new Date(payment.createdAt) >= currentStart &&
        new Date(payment.createdAt) <= currentEnd &&
        payment.status === 'COMPLETED',
    );
    const previousPayments = allPayments.filter(
      (payment) =>
        new Date(payment.createdAt) >= previousStart &&
        new Date(payment.createdAt) < previousEnd &&
        payment.status === 'COMPLETED',
    );

    const currentRevenue = currentPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const previousRevenue = previousPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    // حساب النسبة المئوية للتغيير
    const visitsChange =
      previousVisits.length > 0
        ? ((currentVisits.length - previousVisits.length) /
            previousVisits.length) *
          100
        : currentVisits.length > 0
          ? 100
          : 0;

    const revenueChange =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

    return {
      period,
      current: {
        visits: currentVisits.length,
        revenue: Number(currentRevenue),
        startDate: currentStart,
        endDate: currentEnd,
      },
      previous: {
        visits: previousVisits.length,
        revenue: Number(previousRevenue),
        startDate: previousStart,
        endDate: previousEnd,
      },
      changes: {
        visitsChange: Number(visitsChange.toFixed(2)),
        revenueChange: Number(revenueChange.toFixed(2)),
      },
    };
  }
}
