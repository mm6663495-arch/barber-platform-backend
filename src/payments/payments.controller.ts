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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole, PaymentStatus } from '@prisma/client';

@Controller('payments')
@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Body() createPaymentDto: CreatePaymentDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.paymentsService.create(createPaymentDto, currentUser.profileId!);
  }

  @Post('stripe')
  @Roles(UserRole.CUSTOMER)
  processStripePayment(@Body() processPaymentDto: ProcessPaymentDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.paymentsService.processStripePayment(processPaymentDto, currentUser.profileId!);
  }

  @Post('paypal')
  @Roles(UserRole.CUSTOMER)
  processPayPalPayment(@Body() processPaymentDto: ProcessPaymentDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.paymentsService.processPayPalPayment(processPaymentDto, currentUser.profileId!);
  }

  @Post('paypal/execute')
  @Roles(UserRole.CUSTOMER)
  executePayPalPayment(
    @Body('paypalPaymentId') paypalPaymentId: string,
    @Body('payerId') payerId: string,
  ) {
    return this.paymentsService.executePayPalPayment(paypalPaymentId, payerId);
  }

  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    return this.paymentsService.findAll(customerIdNum, status);
  }

  @Get('my-payments')
  @Roles(UserRole.CUSTOMER)
  getMyPayments(@CurrentUser() currentUser: CurrentUserData) {
    return this.paymentsService.findAll(currentUser.profileId!);
  }

  @Get('statistics')
  getStatistics(
    @Query('customerId') customerId?: string,
    @Query('salonId') salonId?: string,
  ) {
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    return this.paymentsService.getPaymentStatistics(customerIdNum, salonIdNum);
  }

  @Get('recent')
  getRecentPayments(
    @Query('limit') limit?: string,
    @Query('customerId') customerId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    return this.paymentsService.getRecentPayments(limitNum, customerIdNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() refundPaymentDto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(id, refundPaymentDto.amount, refundPaymentDto.reason);
  }

  /**
   * الحصول على بوابات الدفع المتاحة
   */
  @Get('gateways/available')
  getAvailableGateways() {
    return {
      success: true,
      data: {
        gateways: this.paymentsService.getAvailableGateways(),
      },
    };
  }

  /**
   * الحصول على سجل المدفوعات الموحد
   */
  @Get('history/unified')
  getUnifiedPaymentHistory(
    @Query('userId') userId?: string,
    @Query('customerId') customerId?: string,
    @Query('salonId') salonId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getUnifiedPaymentHistory({
      userId: userId ? parseInt(userId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      salonId: salonId ? parseInt(salonId, 10) : undefined,
      status,
      paymentMethod,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * الحصول على إحصائيات شاملة
   */
  @Get('statistics/comprehensive')
  getComprehensiveStatistics(
    @Query('userId') userId?: string,
    @Query('customerId') customerId?: string,
    @Query('salonId') salonId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentsService.getComprehensiveStatistics({
      userId: userId ? parseInt(userId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      salonId: salonId ? parseInt(salonId, 10) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * تصدير سجل المدفوعات
   */
  @Get('history/export')
  exportPaymentHistory(
    @Query('userId') userId?: string,
    @Query('customerId') customerId?: string,
    @Query('salonId') salonId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ) {
    return this.paymentsService.exportPaymentHistory(
      {
        userId: userId ? parseInt(userId, 10) : undefined,
        customerId: customerId ? parseInt(customerId, 10) : undefined,
        salonId: salonId ? parseInt(salonId, 10) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      format,
    );
  }

  /**
   * تأكيد الدفع بعد اكتماله
   */
  @Post(':id/confirm')
  @Roles(UserRole.CUSTOMER)
  confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body('gateway') gateway: 'stripe' | 'paypal',
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.paymentsService.confirmPayment(id, gateway);
  }
}
