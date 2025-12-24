import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';
import { Enable2FADto, Verify2FADto, Disable2FADto, RegenerateBackupCodesDto } from './dto/two-factor.dto';

@ApiTags('2FA')
@Controller('2fa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TwoFactorController {
  constructor(private twoFactorService: TwoFactorService) {}

  /**
   * إنشاء سر 2FA و QR Code
   */
  @Post('setup')
  @ApiOperation({ summary: 'Setup 2FA - Generate secret and QR code' })
  @ApiResponse({ status: 200, description: '2FA setup data returned' })
  async setup2FA(@Request() req) {
    try {
      // ⭐ JwtAuthGuard يضع userId وليس id
      const userId = req.user?.userId || req.user?.id;
      const userEmail = req.user?.email;

      if (!userId) {
        throw new UnauthorizedException('User ID not found in token');
      }

      if (!userEmail) {
        throw new UnauthorizedException('User email not found in token');
      }

      // إنشاء السر
      const { secret, otpauthUrl } = await this.twoFactorService.generateSecret(
        userId,
        userEmail,
      );

      // إنشاء QR Code
      let qrCode: string | null = null;
      if (otpauthUrl) {
        try {
          qrCode = await this.twoFactorService.generateQRCode(otpauthUrl);
        } catch (error) {
          console.error('[2FA Controller] Failed to generate QR code:', error);
          // نستمر حتى لو فشل QR Code - يمكن للمستخدم استخدام Secret Key
        }
      }

      return {
        success: true,
        secret,
        qrCode: qrCode || null,
        otpauthUrl: otpauthUrl || null, // إرجاع otpauthUrl أيضاً كبديل
        message: qrCode 
          ? 'Scan the QR code with Google Authenticator app'
          : 'Use the secret key to manually add to Google Authenticator',
      };
    } catch (error) {
      console.error('[2FA Controller] Setup error:', error);
      throw error;
    }
  }

  /**
   * تفعيل 2FA
   */
  @Post('enable')
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async enable2FA(
    @Body() enableDto: Enable2FADto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const result = await this.twoFactorService.enable2FA(
      userId,
      enableDto.token,
    );

    return {
      ...result,
      message: '2FA enabled successfully. Save your backup codes!',
    };
  }

  /**
   * تعطيل 2FA
   */
  @Delete('disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(
    @Body() disableDto: Disable2FADto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    await this.twoFactorService.disable2FA(userId, disableDto.password);

    return {
      enabled: false,
      message: '2FA has been disabled',
    };
  }

  /**
   * التحقق من كود 2FA
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code' })
  @ApiResponse({ status: 200, description: 'Code verified successfully' })
  async verify2FA(
    @Body() verifyDto: Verify2FADto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const isValid = await this.twoFactorService.verify2FA(
      userId,
      verifyDto.code,
    );

    if (!isValid) {
      return {
        valid: false,
        message: 'Invalid code',
      };
    }

    return {
      valid: true,
      message: 'Code verified successfully',
    };
  }

  /**
   * الحصول على حالة 2FA
   */
  @Get('status')
  @ApiOperation({ summary: 'Get 2FA status' })
  @ApiResponse({ status: 200, description: '2FA status returned' })
  async get2FAStatus(@Request() req) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const status = await this.twoFactorService.get2FAStatus(userId);

    return status;
  }

  /**
   * إعادة إنشاء backup codes
   */
  @Post('backup-codes/regenerate')
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiResponse({ status: 200, description: 'Backup codes regenerated' })
  async regenerateBackupCodes(
    @Body() regenerateDto: RegenerateBackupCodesDto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      userId,
      regenerateDto.token,
    );

    return {
      backupCodes,
      message: 'Save these backup codes in a safe place!',
    };
  }

  /**
   * التحقق من backup code
   */
  @Post('backup-codes/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify backup code' })
  @ApiResponse({ status: 200, description: 'Backup code verified' })
  async verifyBackupCode(
    @Body() verifyDto: Verify2FADto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const isValid = await this.twoFactorService.verifyBackupCode(
      userId,
      verifyDto.code,
    );

    if (!isValid) {
      return {
        valid: false,
        message: 'Invalid or already used backup code',
      };
    }

    return {
      valid: true,
      message: 'Backup code verified successfully',
    };
  }
}

