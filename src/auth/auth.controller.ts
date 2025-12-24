import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'auth',
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() body: { refreshToken: string }) {
    // التحقق من وجود refreshToken في body
    if (!body.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshTokenByRefreshToken(body.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.resetToken,
      resetPasswordDto.newPassword,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    console.log('[AuthController] Change password endpoint called');
    console.log('[AuthController] User ID from token:', req.user?.userId);
    console.log('[AuthController] Request body:', {
      currentPassword: changePasswordDto.currentPassword ? '***' : 'missing',
      newPassword: changePasswordDto.newPassword ? '***' : 'missing',
      currentPasswordLength: changePasswordDto.currentPassword?.length || 0,
      newPasswordLength: changePasswordDto.newPassword?.length || 0,
    });

    const result = await this.authService.changePassword(
      req.user.userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    console.log('[AuthController] Change password result:', result);
    return result;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.validateUser(req.user.userId);
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async validate(@Request() req) {
    return { valid: true, user: req.user };
  }

  // 2FA endpoints
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setup2FA(@Request() req) {
    console.log('[AuthController] Setup 2FA called');
    console.log('[AuthController] User ID:', req.user?.userId);
    
    const userData = await this.authService.validateUser(req.user.userId);
    // userData contains: { userId, email, role, profile }
    const userEmail = userData?.email || req.user?.email;
    
    console.log('[AuthController] User email:', userEmail);
    
    if (!userEmail) {
      throw new UnauthorizedException('User email not found');
    }
    
    const result = await this.authService.setup2FA(req.user.userId, userEmail);
    console.log('[AuthController] Setup 2FA result:', {
      hasSecret: !!result.secret,
      hasQrCode: !!result.qrCode,
      hasOtpauthUrl: !!result.otpauthUrl,
    });
    
    return result;
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Request() req) {
    return this.authService.get2FAStatus(req.user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2FA(@Request() req, @Body() body: { token: string }) {
    console.log('[AuthController] Enable 2FA called');
    console.log('[AuthController] User ID:', req.user?.userId);
    console.log('[AuthController] Token received:', body.token ? `${body.token.substring(0, 2)}***` : 'missing');
    
    if (!body.token) {
      throw new UnauthorizedException('Token is required');
    }
    
    return this.authService.enable2FA(req.user.userId, body.token);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2FA(@Request() req, @Body() body: { password: string }) {
    return this.authService.disable2FA(req.user.userId, body.password);
  }

  // ⭐ التحقق من 2FA أثناء تسجيل الدخول (بدون JWT)
  @Post('2fa/verify-login')
  @HttpCode(HttpStatus.OK)
  async verify2FALogin(@Body() body: { userId: number; code: string }) {
    return this.authService.verify2FALogin(body.userId, body.code);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Request() req,
    @Body() verify2FADto: Verify2FADto,
  ) {
    return this.authService.verify2FA(req.user.userId, verify2FADto.code);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }
}
