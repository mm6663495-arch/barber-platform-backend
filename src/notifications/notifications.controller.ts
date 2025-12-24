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
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SendGeneralNotificationDto } from './dto/send-general-notification.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { ScheduleNotificationDto } from './dto/schedule-notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Post('general')
  @Roles(UserRole.ADMIN)
  sendGeneralNotification(@Body() sendGeneralNotificationDto: SendGeneralNotificationDto) {
    return this.notificationsService.sendGeneralNotification(
      sendGeneralNotificationDto.userIds,
      sendGeneralNotificationDto.title,
      sendGeneralNotificationDto.message,
    );
  }

  @Get()
  getMyNotifications(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const unreadOnlyBool = unreadOnly === 'true';
    return this.notificationsService.findAll(currentUser.userId, pageNum, limitNum, unreadOnlyBool);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.getUnreadCount(currentUser.userId);
  }

  @Get('statistics')
  getStatistics(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.notificationsService.getNotificationStatistics(userIdNum);
  }

  // Notification Settings endpoints - يجب أن تكون قبل @Get(':id') لتجنب التعارض
  @Get('settings')
  getNotificationSettings(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.getNotificationSettings(currentUser.userId);
  }

  @Patch('settings')
  updateNotificationSettings(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() updateSettingsDto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateNotificationSettings(
      currentUser.userId,
      updateSettingsDto,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.findOne(id, currentUser.userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.markAsRead(id, currentUser.userId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.markAllAsRead(currentUser.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.remove(id, currentUser.userId);
  }

  // Admin endpoints
  @Post('cleanup')
  @Roles(UserRole.ADMIN)
  cleanupOldNotifications(@Query('daysOld') daysOld?: string) {
    const daysOldNum = daysOld ? parseInt(daysOld, 10) : 30;
    return this.notificationsService.cleanupOldNotifications(daysOldNum);
  }

  // Specific notification endpoints
  @Post('subscription/:subscriptionId/:type')
  @Roles(UserRole.ADMIN)
  sendSubscriptionNotification(
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @Param('type') type: 'created' | 'expired' | 'renewed',
  ) {
    return this.notificationsService.sendSubscriptionNotification(subscriptionId, type);
  }

  @Post('visit/:visitId/:type')
  @Roles(UserRole.ADMIN)
  sendVisitNotification(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Param('type') type: 'completed' | 'review_reminder',
  ) {
    return this.notificationsService.sendVisitNotification(visitId, type);
  }

  @Post('review/:reviewId/:type')
  @Roles(UserRole.ADMIN)
  sendReviewNotification(
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Param('type') type: 'new_review' | 'response',
  ) {
    return this.notificationsService.sendReviewNotification(reviewId, type);
  }

  @Post('payment/:paymentId/:type')
  @Roles(UserRole.ADMIN)
  sendPaymentNotification(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Param('type') type: 'success' | 'failed' | 'refund',
  ) {
    return this.notificationsService.sendPaymentNotification(paymentId, type);
  }

  @Post('broadcast')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Broadcast notification to multiple users' })
  broadcastNotification(@Body() broadcastDto: BroadcastNotificationDto) {
    return this.notificationsService.broadcastNotification(broadcastDto);
  }

  @Post('schedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Schedule a notification to be sent later' })
  scheduleNotification(@Body() scheduleDto: ScheduleNotificationDto) {
    return this.notificationsService.scheduleNotification(scheduleDto);
  }

  @Get('scheduled')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all scheduled notifications' })
  getScheduledNotifications() {
    return this.notificationsService.getScheduledNotifications();
  }

  @Delete('scheduled/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a scheduled notification' })
  cancelScheduledNotification(@Param('id') id: string) {
    return this.notificationsService.cancelScheduledNotification(id);
  }
}
