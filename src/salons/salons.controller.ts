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
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SalonsService } from './salons.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('salons')
@ApiTags('Salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  // Public endpoints (no authentication required)
  @Get()
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'minRating', required: false, type: String, description: 'Minimum rating (e.g., 4.0)' })
  @ApiQuery({ name: 'location', required: false, type: String, description: 'Location filter' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Status filter: APPROVED, PENDING, SUSPENDED' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('minRating') minRating?: string,
    @Query('location') location?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const filters = {
      search,
      minRating: minRating ? parseFloat(minRating) : undefined,
      location,
      status,
    };
    return this.salonsService.findAll(pageNum, limitNum, filters);
  }

  @Get('popular')
  getPopularSalons(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.salonsService.getPopularSalons(limitNum);
  }

  @Get('nearby')
  @ApiQuery({ name: 'latitude', required: true, type: String, description: 'Latitude' })
  @ApiQuery({ name: 'longitude', required: true, type: String, description: 'Longitude' })
  @ApiQuery({ name: 'radius', required: false, type: String, description: 'Radius in km (default: 10)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  getNearbySalons(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radius') radius?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radiusKm = radius ? parseFloat(radius) : 10.0;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.salonsService.findNearby(lat, lon, radiusKm, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salonsService.findOne(id);
  }

  @Get(':id/packages')
  findPackages(@Param('id', ParseIntPipe) id: number) {
    return this.salonsService.findPackages(id);
  }

  // Protected endpoints
  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  create(@Body() createSalonDto: CreateSalonDto, @CurrentUser() currentUser: CurrentUserData) {
    // Logging للتحقق من البيانات المستلمة من الفرونت إند
    console.log('📥 [SALONS CONTROLLER] Received create salon request:');
    console.log('  - Body:', JSON.stringify(createSalonDto, null, 2));
    console.log('  - logo in DTO:', createSalonDto.logo ?? 'undefined');
    console.log('  - logo type:', typeof createSalonDto.logo);
    console.log('  - logo === null:', createSalonDto.logo === null);
    console.log('  - logo === undefined:', createSalonDto.logo === undefined);
    console.log('  - logo isEmpty:', !createSalonDto.logo || createSalonDto.logo.trim() === '');
    
    // ⭐ تحويل empty string إلى undefined
    // إذا كان logo empty string، نحوله إلى undefined ليتمكن Service من التعامل معه
    if (createSalonDto.logo === '') {
      console.log('⚠️ [SALONS CONTROLLER] Logo is empty string - converting to undefined');
      createSalonDto.logo = undefined;
    }
    
    return this.salonsService.create(createSalonDto, currentUser.profileId!);
  }

  @Get('owner/my-salons')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  findMySalons(@CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.findByOwner(currentUser.profileId!);
  }

  @Get('owner/statistics')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  getOwnerStatistics(@CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.getSalonStatistics(currentUser.profileId!);
  }

  @Get(':id/statistics')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  getSalonStatistics(
    @Param('id', ParseIntPipe) salonId: number,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.salonsService.getSingleSalonStatistics(
      salonId,
      currentUser.profileId!,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSalonDto: UpdateSalonDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    // إذا كان المستخدم ADMIN، استخدم updateByAdmin
    if (currentUser.role === UserRole.ADMIN) {
      return this.salonsService.updateByAdmin(id, updateSalonDto);
    }
    return this.salonsService.update(id, updateSalonDto, currentUser.profileId!);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.remove(id, currentUser.profileId!);
  }

  // Package Management
  @Post(':id/packages')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  createPackage(
    @Param('id', ParseIntPipe) salonId: number,
    @Body() createPackageDto: CreatePackageDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.salonsService.createPackage(salonId, createPackageDto, currentUser.profileId!);
  }

  @Get('packages/:packageId')
  findPackage(@Param('packageId', ParseIntPipe) packageId: number) {
    return this.salonsService.findPackage(packageId);
  }

  @Patch('packages/:packageId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  updatePackage(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() updatePackageDto: UpdatePackageDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.salonsService.updatePackage(packageId, updatePackageDto, currentUser.profileId!);
  }

  @Delete('packages/:packageId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  removePackage(@Param('packageId', ParseIntPipe) packageId: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.removePackage(packageId, currentUser.profileId!);
  }

  @Patch('packages/:packageId/publish')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  publishPackage(@Param('packageId', ParseIntPipe) packageId: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.publishPackage(packageId, currentUser.profileId!);
  }

  @Patch('packages/:packageId/unpublish')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SALON_OWNER)
  unpublishPackage(@Param('packageId', ParseIntPipe) packageId: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.salonsService.unpublishPackage(packageId, currentUser.profileId!);
  }

  // Admin endpoints
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  approveSalon(@Param('id', ParseIntPipe) id: number) {
    return this.salonsService.approveSalon(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  rejectSalon(@Param('id', ParseIntPipe) id: number) {
    return this.salonsService.rejectSalon(id);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  suspendSalon(@Param('id', ParseIntPipe) id: number, @Body() body?: { reason?: string }) {
    return this.salonsService.suspendSalon(id, body?.reason);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  activateSalon(@Param('id', ParseIntPipe) id: number) {
    return this.salonsService.activateSalon(id);
  }

  // Advanced Statistics Endpoints
  @Get('my/statistics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get comprehensive statistics for the current salon owner' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getMyStatistics(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('period') period?: string, // 'week', 'month', 'quarter', 'year'
  ) {
    return this.salonsService.getMyStatistics(currentUser.userId, period);
  }

  @Get('my/financial-analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get financial analytics for the current salon owner' })
  @ApiResponse({ status: 200, description: 'Financial analytics retrieved successfully' })
  getMyFinancialAnalytics(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('period') period?: string, // 'daily', 'weekly', 'monthly'
  ) {
    return this.salonsService.getMyFinancialAnalytics(
      currentUser.userId,
      startDate,
      endDate,
      period,
    );
  }

  @Get('my/performance-reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance reports for the current salon owner' })
  @ApiResponse({ status: 200, description: 'Performance reports retrieved successfully' })
  getMyPerformanceReports(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salonsService.getMyPerformanceReports(
      currentUser.userId,
      startDate,
      endDate,
    );
  }

  @Get('my/time-comparisons')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get time-based comparisons for the current salon owner' })
  @ApiResponse({ status: 200, description: 'Time comparisons retrieved successfully' })
  getMyTimeComparisons(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('period') period?: string, // 'week', 'month', 'quarter', 'year'
  ) {
    return this.salonsService.getMyTimeComparisons(currentUser.userId, period);
  }
}
