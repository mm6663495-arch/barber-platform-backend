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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { RespondToReviewDto } from './dto/respond-to-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('reviews')
@ApiTags('Reviews')
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  create(@Body() createReviewDto: CreateReviewDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.reviewsService.create(createReviewDto, currentUser.profileId!);
  }

  @Get()
  findAll(
    @Query('salonId') salonId?: string,
    @Query('customerId') customerId?: string,
    @Query('packageId') packageId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
  ) {
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    const packageIdNum = packageId ? parseInt(packageId, 10) : undefined;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const ratingNum = rating ? parseInt(rating, 10) : undefined;
    return this.reviewsService.findAll(salonIdNum, customerIdNum, packageIdNum, pageNum, limitNum, ratingNum, status);
  }

  @Get('recent')
  getRecentReviews(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getRecentReviews(limitNum);
  }

  @Get('statistics')
  getStatistics(
    @Query('salonId') salonId?: string,
    @Query('customerId') customerId?: string,
  ) {
    const salonIdNum = salonId ? parseInt(salonId, 10) : undefined;
    const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
    return this.reviewsService.getReviewStatistics(salonIdNum, customerIdNum);
  }

  @Get('salon/:salonId')
  getSalonReviews(
    @Param('salonId', ParseIntPipe) salonId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getSalonReviews(salonId, pageNum, limitNum);
  }

  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  getMyReviews(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getCustomerReviews(currentUser.profileId!, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.reviewsService.update(id, updateReviewDto, currentUser.profileId!);
  }

  @Patch(':id/respond')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  respondToReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() respondToReviewDto: RespondToReviewDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.reviewsService.respondToReview(id, respondToReviewDto, currentUser.profileId!);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  reportReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() reportReviewDto: ReportReviewDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.reviewsService.reportReview(id, currentUser.userId, reportReviewDto.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    // إذا كان المستخدم ADMIN، يمكنه حذف أي تقييم
    if (currentUser.role === UserRole.ADMIN) {
      return this.reviewsService.removeByAdmin(id);
    }
    // إذا كان CUSTOMER، يمكنه حذف تقييماته فقط
    return this.reviewsService.remove(id, currentUser.profileId!);
  }

  @Post('check-edit-period')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  checkAndUpdateCanEditFlag() {
    return this.reviewsService.checkAndUpdateCanEditFlag();
  }

  /**
   * الحصول على إحصائيات شاملة للتقييمات (للمسؤولين)
   */
  @Get('monitoring/statistics')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  getComprehensiveStatistics(
    @Query('salonId') salonId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reviewsService.getComprehensiveStatistics({
      salonId: salonId ? parseInt(salonId, 10) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * الحصول على التقييمات المشبوهة
   */
  @Get('monitoring/suspicious')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  getSuspiciousReviews(
    @Query('minReports') minReports?: string,
    @Query('minNegativeRating') minNegativeRating?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reviewsService.getSuspiciousReviews({
      minReports: minReports ? parseInt(minReports, 10) : undefined,
      minNegativeRating: minNegativeRating
        ? parseInt(minNegativeRating, 10)
        : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * الحصول على تقييمات تحتاج رد
   */
  @Get('monitoring/needing-response')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  getReviewsNeedingResponse(
    @Query('salonId') salonId?: string,
    @Query('daysOld') daysOld?: string,
  ) {
    return this.reviewsService.getReviewsNeedingResponse({
      salonId: salonId ? parseInt(salonId, 10) : undefined,
      daysOld: daysOld ? parseInt(daysOld, 10) : undefined,
    });
  }

  /**
   * تحليل جودة التقييم
   */
  @Get('monitoring/:id/analyze')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  analyzeReviewQuality(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.analyzeReviewQuality(id);
  }
}
