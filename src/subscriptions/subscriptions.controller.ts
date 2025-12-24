import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UseVisitDto } from './dto/use-visit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('subscriptions')
@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Body() createSubscriptionDto: CreateSubscriptionDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.subscriptionsService.create(createSubscriptionDto, currentUser.profileId!);
  }

  @Get()
  @ApiOperation({ summary: 'Get subscriptions with optional filters' })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('userId') userId?: string,
    @Query('salonId') salonId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    let effectiveCustomerId: number | undefined;
    
    // If customerId is provided, use it
    if (customerId) {
      effectiveCustomerId = parseInt(customerId, 10);
    } 
    // If userId is provided without customerId, convert it to customerId
    else if (userId) {
      try {
        const customer = await this.prisma.customer.findUnique({
          where: { userId: parseInt(userId, 10) },
          select: { id: true },
        });
        if (customer) {
          effectiveCustomerId = customer.id;
        }
      } catch (error) {
        console.error('Error converting userId to customerId:', error);
        // Continue without customerId filter if conversion fails
      }
    }
    
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    return this.subscriptionsService.findAll(effectiveCustomerId, salonIdNum, status);
  }

  @Get('my-subscriptions')
  @Roles(UserRole.CUSTOMER)
  getMySubscriptions(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptionsService.getCustomerSubscriptions(currentUser.profileId!, status);
  }

  @Get('salon/:salonId')
  @Roles(UserRole.SALON_OWNER)
  getSalonSubscriptions(
    @Param('salonId', ParseIntPipe) salonId: number,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptionsService.getSalonSubscriptions(salonId, status);
  }

  @Get('statistics')
  getStatistics(
    @Query('customerId') customerId?: string,
    @Query('salonId') salonId?: string,
  ) {
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    return this.subscriptionsService.getSubscriptionStatistics(customerIdNum, salonIdNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.findOne(id);
  }

  @Get('qr/:qrCode')
  findByQrCode(@Param('qrCode') qrCode: string) {
    return this.subscriptionsService.findByQrCode(qrCode);
  }

  // ⭐ الحصول على عملاء صالون محدد
  @Get('salon/:salonId/customers')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'الحصول على عملاء صالون محدد' })
  getSalonCustomers(
    @Param('salonId', ParseIntPipe) salonId: number,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('status') status?: string,
  ) {
    return this.subscriptionsService.getSalonCustomers(
      salonId,
      currentUser.profileId!,
      status,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.subscriptionsService.update(id, updateSubscriptionDto, currentUser.userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CUSTOMER)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.subscriptionsService.cancel(id, currentUser.profileId!);
  }

  @Patch(':id/renew')
  @Roles(UserRole.CUSTOMER)
  renew(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.subscriptionsService.renew(id, currentUser.profileId!);
  }

  @Post('use-visit')
  @Roles(UserRole.SALON_OWNER)
  useVisit(@Body() useVisitDto: UseVisitDto, @CurrentUser() currentUser: CurrentUserData) {
    // You might want to get salonId from the salon owner's profile
    // For now, we'll assume it's passed in the request body or derived from context
    return this.subscriptionsService.useVisit(
      useVisitDto.qrCode,
      currentUser.profileId!,
      useVisitDto.serviceName,
    );
  }

  @Post('check-expired')
  @Roles(UserRole.ADMIN)
  checkExpiredSubscriptions() {
    return this.subscriptionsService.checkExpiredSubscriptions();
  }

  // Advanced Customer Management Endpoints for Salon Owners
  @Get('customer/:customerId/visits')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'Get customer visit history for salon owner' })
  @ApiResponse({ status: 200, description: 'Customer visits retrieved successfully' })
  getCustomerVisitsForSalon(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('salonId') salonId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.subscriptionsService.getCustomerVisitsForSalon(
      customerId,
      currentUser.profileId!,
      salonIdNum,
      pageNum,
      limitNum,
    );
  }

  @Get('customer/:customerId/preferences')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'Get customer preferences and favorites' })
  @ApiResponse({ status: 200, description: 'Customer preferences retrieved successfully' })
  getCustomerPreferences(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.subscriptionsService.getCustomerPreferences(
      customerId,
      currentUser.profileId!,
    );
  }

  @Get('customer/:customerId/purchase-history')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'Get customer purchase history' })
  @ApiResponse({ status: 200, description: 'Purchase history retrieved successfully' })
  getCustomerPurchaseHistory(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('salonId') salonId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.subscriptionsService.getCustomerPurchaseHistory(
      customerId,
      currentUser.profileId!,
      salonIdNum,
      pageNum,
      limitNum,
    );
  }
}

@Controller('visits')
@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'الحصول على زيارات المستخدم أو الصالون' })
  getVisits(
    @Query('salonId') salonId?: string,
    @Query('userId') userId?: string,
    @CurrentUser() currentUser?: CurrentUserData,
    @Query('date') date?: string,
    @Query('dateRange') dateRange?: string, // 'all', 'today', 'lastMonth'
    @Query('status') status?: string,
  ) {
    // إذا كان userId موجود، هذا طلب من عميل
    if (userId) {
      return this.subscriptionsService.getCustomerVisits(
        parseInt(userId, 10),
        date,
        status,
      );
    }

    // إذا كان salonId موجود، هذا طلب من صاحب صالون
    if (salonId && currentUser) {
      return this.subscriptionsService.getSalonVisits(
        parseInt(salonId, 10),
        currentUser.profileId!,
        date,
        dateRange, // ⭐ إضافة dateRange
        status,
      );
    }

    // إذا كان المستخدم الحالي موجود فقط (CUSTOMER)
    if (currentUser && currentUser.role === UserRole.CUSTOMER) {
      return this.subscriptionsService.getCustomerVisits(
        currentUser.userId,
        date,
        status,
      );
    }

    throw new BadRequestException('Missing required parameters: userId or salonId');
  }

  @Get(':id')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'الحصول على تفاصيل زيارة' })
  getVisit(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.getVisitById(id);
  }

  @Post('scan-qr')
  @Roles(UserRole.SALON_OWNER)
  scanQR(@Body() useVisitDto: UseVisitDto, @CurrentUser() currentUser: CurrentUserData) {
    // Wrapper endpoint to support the app's expected API path
    return this.subscriptionsService.useVisit(
      useVisitDto.qrCode,
      currentUser.profileId!,
      useVisitDto.serviceName,
    );
  }

  // ⭐ الحصول على عملاء صالون محدد
  @Get('salon/:salonId/customers')
  @Roles(UserRole.SALON_OWNER)
  @ApiOperation({ summary: 'الحصول على عملاء صالون محدد' })
  getSalonCustomers(
    @Param('salonId', ParseIntPipe) salonId: number,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('status') status?: string,
  ) {
    return this.subscriptionsService.getSalonCustomers(
      salonId,
      currentUser.profileId!,
      status,
    );
  }

  @Post(':id/confirm')
  @Roles(UserRole.SALON_OWNER)
  confirmVisit(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.confirmVisit(id);
  }

  @Post(':id/complete')
  @Roles(UserRole.SALON_OWNER)
  completeVisit(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.completeVisit(id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.SALON_OWNER)
  cancelVisit(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.cancelVisit(id);
  }
}