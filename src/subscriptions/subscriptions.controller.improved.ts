import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SubscriptionsServiceImproved } from './subscriptions.service.improved';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Paginate } from '../common/decorators/paginate.decorator';
import type { PaginationOptions } from '../common/dto/pagination.dto';
import { ApiResponseDto } from '../common/dto/response.dto';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Subscriptions Controller (محسّن)
 * Controller محسّن مع Pagination و Response DTOs موحدة
 */
@ApiTags('Subscriptions')
@Controller('api/v1/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionsControllerImproved {
  constructor(
    private readonly subscriptionsService: SubscriptionsServiceImproved,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'إنشاء اشتراك جديد' })
  async create(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @CurrentUser() user: any,
  ) {
    const subscription = await this.subscriptionsService.create(
      createSubscriptionDto,
      user.profile.id,
    );
    return ApiResponseDto.success(subscription, 'تم إنشاء الاشتراك بنجاح');
  }

  @Get()
  @ApiOperation({ summary: 'الحصول على جميع الاشتراكات مع Pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'salonId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'اختياري: سيتم تحويله إلى customerId' })
  async findAll(
    @Paginate() pagination: PaginationOptions,
    @Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number,
    @Query('salonId', new ParseIntPipe({ optional: true })) salonId?: number,
    @Query('status') status?: SubscriptionStatus,
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    // إذا أُرسِل userId بدون customerId، حوّله إلى customerId
    let effectiveCustomerId = customerId;
    if (!effectiveCustomerId && userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (customer) {
        effectiveCustomerId = customer.id;
      }
    }

    const result = await this.subscriptionsService.findAll(pagination, {
      customerId: effectiveCustomerId,
      salonId,
      status,
    });
    return ApiResponseDto.success(result, 'تم جلب الاشتراكات بنجاح');
  }

  @Get('my-subscriptions')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'الحصول على اشتراكات العميل الحالي' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  async getMySubscriptions(
    @Paginate() pagination: PaginationOptions,
    @CurrentUser() user: any,
    @Query('status') status?: SubscriptionStatus,
  ) {
    const result = await this.subscriptionsService.getCustomerSubscriptions(
      user.profile.id,
      pagination,
      status,
    );
    return ApiResponseDto.success(result, 'تم جلب اشتراكاتك بنجاح');
  }

  @Get('salon/:salonId')
  @Roles('SALON_OWNER', 'ADMIN')
  @ApiOperation({ summary: 'الحصول على اشتراكات صالون معين' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  async getSalonSubscriptions(
    @Param('salonId', ParseIntPipe) salonId: number,
    @Paginate() pagination: PaginationOptions,
    @Query('status') status?: SubscriptionStatus,
  ) {
    const result = await this.subscriptionsService.getSalonSubscriptions(
      salonId,
      pagination,
      status,
    );
    return ApiResponseDto.success(result, 'تم جلب اشتراكات الصالون بنجاح');
  }

  @Get('statistics')
  @ApiOperation({ summary: 'إحصائيات الاشتراكات' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'salonId', required: false, type: Number })
  async getStatistics(
    @Query('customerId', new ParseIntPipe({ optional: true })) customerId?: number,
    @Query('salonId', new ParseIntPipe({ optional: true })) salonId?: number,
  ) {
    const statistics = await this.subscriptionsService.getSubscriptionStatistics(
      customerId,
      salonId,
    );
    return ApiResponseDto.success(statistics, 'تم جلب الإحصائيات بنجاح');
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'الحصول على اشتراك بواسطة QR Code' })
  async findByQrCode(@Param('qrCode') qrCode: string) {
    const subscription = await this.subscriptionsService.findByQrCode(qrCode);
    return ApiResponseDto.success(subscription, 'تم جلب الاشتراك بنجاح');
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على اشتراك معين' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const subscription = await this.subscriptionsService.findOne(id);
    return ApiResponseDto.success(subscription, 'تم جلب الاشتراك بنجاح');
  }

  @Patch(':id')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'تحديث اشتراك' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @CurrentUser() user: any,
  ) {
    const customerId = user.role === 'CUSTOMER' ? user.profile.id : undefined;
    const subscription = await this.subscriptionsService.update(
      id,
      updateSubscriptionDto,
      customerId,
    );
    return ApiResponseDto.success(subscription, 'تم تحديث الاشتراك بنجاح');
  }

  @Delete(':id/cancel')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'إلغاء اشتراك' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const subscription = await this.subscriptionsService.cancel(id, user.profile.id);
    return ApiResponseDto.success(subscription, 'تم إلغاء الاشتراك بنجاح');
  }

  @Post(':id/renew')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'تجديد اشتراك' })
  async renew(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const subscription = await this.subscriptionsService.renew(id, user.profile.id);
    return ApiResponseDto.success(subscription, 'تم تجديد الاشتراك بنجاح');
  }

  @Post('use-visit')
  @Roles('SALON_OWNER')
  @ApiOperation({ summary: 'استخدام زيارة من الاشتراك' })
  async useVisit(
    @Body('qrCode') qrCode: string,
    @Body('salonId', ParseIntPipe) salonId: number,
  ) {
    const result = await this.subscriptionsService.useVisit(qrCode, salonId);
    return ApiResponseDto.success(result, 'تم تسجيل الزيارة بنجاح');
  }
}

