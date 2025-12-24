import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { ScheduleBackupDto } from './dto/schedule-backup.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('backup')
@ApiTags('Backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  @ApiOperation({ summary: 'إنشاء نسخة احتياطية' })
  async createBackup(
    @Request() req,
    @Body() createBackupDto: CreateBackupDto,
  ) {
    return this.backupService.createBackup(req.user.userId, createBackupDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'الحصول على تاريخ النسخ الاحتياطية' })
  async getBackupHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    // If admin, get all backups; otherwise, get user's backups only
    const userId =
      req.user.role === UserRole.ADMIN ? undefined : req.user.userId;
    return this.backupService.getBackupHistory(userId, pageNum, limitNum);
  }

  @Post('restore')
  @ApiOperation({ summary: 'استعادة نسخة احتياطية' })
  async restoreBackup(
    @Request() req,
    @Body() restoreBackupDto: RestoreBackupDto,
  ) {
    return this.backupService.restoreBackup(req.user.userId, restoreBackupDto);
  }

  @Delete(':backupId')
  @ApiOperation({ summary: 'حذف نسخة احتياطية' })
  async deleteBackup(@Request() req, @Param('backupId') backupId: string) {
    return this.backupService.deleteBackup(req.user.userId, backupId);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule automatic backups' })
  async scheduleBackup(
    @Request() req,
    @Body() scheduleDto: ScheduleBackupDto,
  ) {
    // If admin, can schedule system backups; otherwise, user backups
    const userId =
      req.user.role === UserRole.ADMIN ? null : req.user.userId;
    return this.backupService.scheduleBackup(userId, scheduleDto);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get backup schedule' })
  async getBackupSchedule(@Request() req) {
    const userId =
      req.user.role === UserRole.ADMIN ? undefined : req.user.userId;
    return this.backupService.getBackupSchedule(userId);
  }

  @Post('system')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create system-wide backup (Admin only)' })
  async createSystemBackup(@Body() createBackupDto: CreateBackupDto) {
    return this.backupService.createSystemBackup(createBackupDto);
  }

  @Post('system/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore system backup (Admin only)' })
  async restoreSystemBackup(@Body() restoreBackupDto: RestoreBackupDto) {
    return this.backupService.restoreSystemBackup(restoreBackupDto);
  }
}

