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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.create(createUserDto, currentUser.role as UserRole);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    // Validate and convert role if provided
    let validRole: UserRole | undefined;
    if (role) {
      const upperRole = role.toUpperCase();
      if (Object.values(UserRole).includes(upperRole as UserRole)) {
        validRole = upperRole as UserRole;
      }
    }
    
    return this.usersService.findAll(validRole, pageNum, limitNum);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  getStatistics() {
    return this.usersService.getStatistics();
  }

  @Get('recent')
  @Roles(UserRole.ADMIN)
  getRecentUsers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getRecentUsers(limitNum);
  }

  @Get('profile')
  getProfile(@CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.getProfile(currentUser.userId);
  }

  @Get('my-statistics')
  @ApiOperation({ summary: 'Get user statistics (visits, subscriptions, reviews, etc.)' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  getUserStatistics(@CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.getUserStatistics(currentUser.userId);
  }

  @Post('fcm-token')
  saveFcmToken(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() body: { fcmToken: string },
  ) {
    return this.usersService.saveFcmToken(currentUser.userId, body.fcmToken);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser.userId, currentUser.role as UserRole);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.deactivate(id, currentUser.role as UserRole);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.activate(id, currentUser.role as UserRole);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.remove(id, currentUser.userId, currentUser.role as UserRole);
  }

  // ⭐ إدارة Admins - إنشاء Admin جديد
  @Post('admins')
  @Roles(UserRole.ADMIN)
  createAdmin(@Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: CurrentUserData) {
    // التأكد من أن role هو ADMIN
    if (createUserDto.role !== UserRole.ADMIN) {
      createUserDto.role = UserRole.ADMIN;
    }
    return this.usersService.create(createUserDto, currentUser.role as UserRole);
  }

  // ⭐ جلب جميع Admins
  @Get('admins/list')
  @Roles(UserRole.ADMIN)
  getAdmins(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.usersService.findAll(UserRole.ADMIN, pageNum, limitNum);
  }

  // ⭐ حذف Admin
  @Delete('admins/:id')
  @Roles(UserRole.ADMIN)
  deleteAdmin(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.removeAdmin(id, currentUser.userId, currentUser.role as UserRole);
  }

  // ⭐ تصدير قائمة المستخدمين
  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'تصدير قائمة المستخدمين' })
  @ApiResponse({ status: 200, description: 'تم تصدير قائمة المستخدمين بنجاح' })
  exportUsers(@Query('role') role?: string) {
    const validRole = role ? (role.toUpperCase() as UserRole) : undefined;
    return this.usersService.exportUsers(validRole);
  }

  // ⭐ استيراد المستخدمين
  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'استيراد المستخدمين من ملف Excel/CSV' })
  @ApiResponse({ status: 200, description: 'تم استيراد المستخدمين بنجاح' })
  importUsers(@Body() body: { users: Array<{ email: string; password?: string; role: UserRole; fullName: string; phone?: string }> }) {
    return this.usersService.importUsers(body.users);
  }

  // ⭐ إحصائيات تفصيلية لكل مستخدم
  @Get(':id/detailed-statistics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'إحصائيات تفصيلية لكل مستخدم' })
  @ApiResponse({ status: 200, description: 'تم جلب الإحصائيات بنجاح' })
  getDetailedUserStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getDetailedUserStatistics(id);
  }
}
