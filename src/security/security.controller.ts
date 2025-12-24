import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('security')
@ApiTags('Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('report')
  generateSecurityReport(@Query('period') period?: 'daily' | 'weekly' | 'monthly') {
    return this.securityService.generateSecurityReport(period || 'weekly');
  }

  @Get('metrics')
  getSecurityMetrics() {
    return this.securityService.getSecurityMetrics();
  }

  @Post('validate-password')
  validatePasswordStrength(@Body('password') password: string) {
    return this.securityService.validatePasswordStrength(password);
  }

  @Post('sanitize')
  sanitizeInput(@Body('input') input: string) {
    return this.securityService.sanitizeInput(input);
  }

  @Get('rate-limit/:identifier')
  checkRateLimit(
    @Param('identifier') identifier: string,
    @Query('limit') limit?: string,
    @Query('window') window?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const windowMs = window ? parseInt(window, 10) : 60000; // 1 minute default
    return this.securityService.rateLimitCheck(identifier, limitNum, windowMs);
  }

  @Post('lock-account/:userId')
  lockUserAccount(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('reason') reason: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.securityService.lockUserAccount(userId, reason);
  }

  @Post('unlock-account/:userId')
  unlockUserAccount(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.securityService.unlockUserAccount(userId, currentUser.userId);
  }

  @Post('cleanup-logs')
  cleanupOldSecurityLogs(@Query('daysOld') daysOld?: string) {
    const daysOldNum = daysOld ? parseInt(daysOld, 10) : 90;
    return this.securityService.cleanupOldSecurityLogs(daysOldNum);
  }

  @Get('suspicious-activity/:userId')
  detectSuspiciousActivity(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('ipAddress') ipAddress?: string,
  ) {
    return this.securityService.detectSuspiciousActivity(userId, ipAddress || '');
  }

  @Get('activity-log')
  getActivityLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.securityService.getActivityLog(pageNum, limitNum, userIdNum);
  }
}
