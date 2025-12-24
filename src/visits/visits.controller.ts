import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { GetVisitsDto } from './dto/get-visits.dto';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('visits')
@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: 'الحصول على زيارات المستخدم' })
  @ApiResponse({ status: 200, description: 'تم جلب الزيارات بنجاح' })
  getUserVisits(
    @CurrentUser() user: CurrentUserData,
    @Query() query: GetVisitsDto,
  ) {
    return this.visitsService.getUserVisits(user.userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'الحصول على إحصائيات الزيارات' })
  @ApiResponse({ status: 200, description: 'تم جلب الإحصائيات بنجاح' })
  getVisitStats(@CurrentUser() user: CurrentUserData) {
    return this.visitsService.getVisitStats(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على تفاصيل زيارة' })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل الزيارة بنجاح' })
  @ApiResponse({ status: 404, description: 'الزيارة غير موجودة' })
  getVisitById(
    @Param('id', ParseIntPipe) visitId: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.visitsService.getVisitById(visitId, user.userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'تحديث حالة الزيارة' })
  @ApiResponse({ status: 200, description: 'تم تحديث حالة الزيارة بنجاح' })
  @ApiResponse({ status: 404, description: 'الزيارة غير موجودة' })
  updateVisitStatus(
    @Param('id', ParseIntPipe) visitId: number,
    @CurrentUser() user: CurrentUserData,
    @Body() updateDto: UpdateVisitStatusDto,
  ) {
    return this.visitsService.updateVisitStatus(visitId, user.userId, updateDto);
  }
}

