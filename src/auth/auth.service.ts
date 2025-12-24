import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private twoFactorService: TwoFactorService, // ⭐ إضافة TwoFactorService
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, role, fullName, phone } = registerDto;

    // Normalize email to lowercase for consistency
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: role as UserRole,
        isActive: true,
      },
    });

    // Create profile based on role
    let profile;
    if (role === 'SALON_OWNER') {
      profile = await this.prisma.salonOwner.create({
        data: {
          userId: user.id,
          fullName,
          phone: phone || '',
          subscriptionType: 'MONTHLY',
          subscriptionStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    } else if (role === 'CUSTOMER') {
      profile = await this.prisma.customer.create({
        data: {
          userId: user.id,
          fullName,
          phone: phone || '',
        },
      });
    } else if (role === 'ADMIN') {
      profile = await this.prisma.platformAdmin.create({
        data: {
          userId: user.id,
          fullName,
          permissions: {},
        },
      });
    }

    // Generate JWT token
    const token = await this.generateToken(user, profile?.id);

    return {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profile: profile,
        },
        accessToken: token,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      // Normalize email to lowercase for case-insensitive lookup
      const normalizedEmail = email.toLowerCase().trim();

      // Find user with error handling
      let user;
      try {
        user = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: {
            platformAdmin: true,
            salonOwner: true,
            customer: true,
          },
        });
      } catch (prismaError: any) {
        console.error(`[Auth] Prisma error during login:`, prismaError);
        // If it's a connection error, provide a more helpful message
        if (prismaError.code === 'P1001' || prismaError.message?.includes('connect')) {
          throw new BadRequestException('Database connection error. Please try again later.');
        }
        throw new BadRequestException('Authentication service error. Please try again.');
      }

      if (!user) {
        // Log for debugging (not exposed to client for security)
        console.log(`[Auth] Login attempt failed: User not found - ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

    // Check if user is active
    if (!user.isActive) {
      console.log(`[Auth] Login attempt failed: Account deactivated - ${normalizedEmail}`);
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log for debugging (not exposed to client for security)
      console.log(`[Auth] Login attempt failed: Invalid password - ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(`[Auth] Login successful - ${normalizedEmail} (ID: ${user.id})`);

    // ⭐ التحقق من 2FA - إذا كان مفعّل، نطلب كود التحقق
    if (user.twoFactorEnabled) {
      return {
        success: false,
        requires2FA: true,
        message: 'يرجى إدخال كود المصادقة الثنائية',
        userId: user.id,
      };
    }

      // Get profile ID
      let profileId: number | undefined;
      if (user.platformAdmin) {
        profileId = user.platformAdmin.id;
      } else if (user.salonOwner) {
        profileId = user.salonOwner.id;
      } else if (user.customer) {
        profileId = user.customer.id;
      }

      // For CUSTOMER role, ensure customer profile exists
      if (user.role === UserRole.CUSTOMER && !user.customer) {
        console.log(`[Auth] Customer profile missing for user ${user.id}, creating...`);
        try {
          const newCustomer = await this.prisma.customer.create({
            data: {
              userId: user.id,
              fullName: email.split('@')[0], // Use email prefix as default name
              phone: null,
            },
          });
          profileId = newCustomer.id;
          // Reload user with customer
          user.customer = newCustomer;
        } catch (createError: any) {
          console.error(`[Auth] Failed to create customer profile:`, createError);
          // Continue without profileId - token generation will handle it
        }
      }

      // Update last login for admin
      if (user.platformAdmin && profileId) {
        try {
          await this.prisma.platformAdmin.update({
            where: { id: profileId },
            data: { lastLogin: new Date() },
          });
        } catch (updateError: any) {
          console.error(`[Auth] Failed to update admin last login:`, updateError);
          // Non-critical error, continue
        }
      }

      // Generate JWT token
      // إنشاء access token و refresh token
      const tokens = await this.generateTokens(user, profileId);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            profile: user.platformAdmin || user.salonOwner || user.customer || null,
          },
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
      };
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      // Log unexpected errors
      console.error(`[Auth] Unexpected error during login:`, error);
      throw new BadRequestException('Login failed. Please try again.');
    }
  }

  async refreshToken(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    let profileId;
    if (user.platformAdmin) profileId = user.platformAdmin.id;
    else if (user.salonOwner) profileId = user.salonOwner.id;
    else if (user.customer) profileId = user.customer.id;

    const tokens = await this.generateTokens(user, profileId);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile: user.platformAdmin || user.salonOwner || user.customer,
      },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  // دالة جديدة للتعامل مع refresh token من body
  async refreshTokenByRefreshToken(refreshToken: string) {
    try {
      console.log('[AuthService] 🔄 Refresh token request received');
      console.log('[AuthService] 🔄 Refresh token length:', refreshToken?.length || 0);

      // التحقق من صحة refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      });

      console.log('[AuthService] ✅ Refresh token verified, userId:', payload.sub);

      // الحصول على المستخدم من payload
      const userId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          platformAdmin: true,
          salonOwner: true,
          customer: true,
        },
      });

      if (!user || !user.isActive) {
        console.log('[AuthService] ❌ User not found or inactive');
        throw new UnauthorizedException('User not found or inactive');
      }

      let profileId;
      if (user.platformAdmin) profileId = user.platformAdmin.id;
      else if (user.salonOwner) profileId = user.salonOwner.id;
      else if (user.customer) profileId = user.customer.id;

      // إنشاء tokens جديدة
      const tokens = await this.generateTokens(user, profileId);

      console.log('[AuthService] ✅ New tokens generated successfully');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
      };
    } catch (error: any) {
      console.error('[AuthService] ❌ Refresh token error:', error.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    console.log(`Reset token for ${email}: ${resetToken}`);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    console.log(`[Auth] ========================================`);
    console.log(`[Auth] Change password request received`);
    console.log(`[Auth] User ID: ${userId}`);
    console.log(`[Auth] Current password length: ${currentPassword?.length || 0}`);
    console.log(`[Auth] New password length: ${newPassword?.length || 0}`);
    
    // Validate inputs
    if (!currentPassword || !newPassword) {
      console.error(`[Auth] ERROR: Missing password fields`);
      throw new BadRequestException('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      console.error(`[Auth] ERROR: New password too short`);
      throw new BadRequestException('New password must be at least 6 characters');
    }
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`[Auth] ERROR: User not found - ID: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    console.log(`[Auth] User found: ${user.email}`);
    console.log(`[Auth] Verifying current password...`);
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      console.error(`[Auth] ERROR: Current password incorrect for user: ${user.email}`);
      throw new BadRequestException('Current password is incorrect');
    }

    console.log(`[Auth] Current password verified successfully`);
    console.log(`[Auth] Hashing new password...`);
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log(`[Auth] New password hashed successfully`);

    console.log(`[Auth] Updating password in database...`);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Verify the update was successful
    if (!updatedUser) {
      console.error(`[Auth] ERROR: Password update returned null for user: ${user.email}`);
      throw new BadRequestException('Failed to update password');
    }

    console.log(`[Auth] Password updated in database successfully`);
    console.log(`[Auth] Verifying new password can be used...`);

    // Double-check: verify the new password can be used
    const verifyNewPassword = await bcrypt.compare(newPassword, updatedUser.password);
    if (!verifyNewPassword) {
      console.error(`[Auth] ERROR: Password verification failed after update for user: ${user.email}`);
      console.error(`[Auth] This should never happen - database update may have failed`);
      throw new BadRequestException('Password update verification failed');
    }

    console.log(`[Auth] ✅ Password changed successfully for user: ${user.email}`);
    console.log(`[Auth] User ID: ${updatedUser.id}`);
    console.log(`[Auth] ========================================`);
    
    return { 
      success: true,
      message: 'Password changed successfully' 
    };
  }

  private async generateToken(user: User, profileId?: number) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profileId,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }

  // دالة لإنشاء access token و refresh token
  private async generateTokens(user: User, profileId?: number) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profileId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h', // access token ينتهي بعد ساعة
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d', // refresh token ينتهي بعد 7 أيام
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      profile: user.platformAdmin || user.salonOwner || user.customer,
    };
  }

  // 2FA Methods
  async setup2FA(userId: number, userEmail: string) {
    // استخدام TwoFactorService لإعداد 2FA
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
        console.error('[AuthService] Failed to generate QR code:', error);
        // نستمر حتى لو فشل QR Code
      }
    }

    return {
      success: true,
      secret,
      qrCode: qrCode || null,
      otpauthUrl: otpauthUrl || null,
      message: qrCode
        ? 'Scan the QR code with Google Authenticator app'
        : 'Use the secret key to manually add to Google Authenticator',
    };
  }

  async get2FAStatus(userId: number) {
    return this.twoFactorService.get2FAStatus(userId);
  }

  async enable2FA(userId: number, token: string) {
    const result = await this.twoFactorService.enable2FA(userId, token);
    return {
      ...result,
      message: '2FA enabled successfully. Save your backup codes!',
    };
  }

  async disable2FA(userId: number, password: string) {
    return this.twoFactorService.disable2FA(userId, password);
  }

  // ⭐ التحقق من 2FA أثناء تسجيل الدخول (بدون JWT)
  async verify2FALogin(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // ⭐ استخدام TwoFactorService للتحقق من الكود بشكل صحيح
    if (!code || code.length !== 6) {
      throw new BadRequestException('Invalid verification code');
    }

    try {
      const isValid = await this.twoFactorService.verifyToken(user.id, code);
      if (!isValid) {
        throw new BadRequestException('Invalid verification code');
      }
    } catch (error) {
      throw new BadRequestException('Invalid verification code');
    }

    // Get profile ID
    let profileId;
    if (user.platformAdmin) profileId = user.platformAdmin.id;
    else if (user.salonOwner) profileId = user.salonOwner.id;
    else if (user.customer) profileId = user.customer.id;

    // Update last login for admin
    if (user.platformAdmin) {
      await this.prisma.platformAdmin.update({
        where: { id: profileId },
        data: { lastLogin: new Date() },
      });
    }

    // Generate JWT token
    const token = await this.generateToken(user, profileId);

    return {
      success: true,
      message: '2FA verification successful',
      verified: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profile: user.platformAdmin || user.salonOwner || user.customer,
        },
        accessToken: token,
      },
    };
  }

  async verify2FA(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // ⭐ استخدام TwoFactorService للتحقق من الكود بشكل صحيح
    if (!code || code.length !== 6) {
      throw new BadRequestException('Invalid verification code');
    }

    try {
      const isValid = await this.twoFactorService.verifyToken(user.id, code);
      if (!isValid) {
        throw new BadRequestException('Invalid verification code');
      }
    } catch (error) {
      throw new BadRequestException('Invalid verification code');
    }

    // Get profile ID
    let profileId;
    if (user.platformAdmin) profileId = user.platformAdmin.id;
    else if (user.salonOwner) profileId = user.salonOwner.id;
    else if (user.customer) profileId = user.customer.id;

    // Generate JWT token
    const token = await this.generateToken(user, profileId);

    return {
      success: true,
      message: '2FA verification successful',
      verified: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profile: user.platformAdmin || user.salonOwner || user.customer,
        },
        accessToken: token,
      },
    };
  }

  async logout(userId: number) {
    // For JWT-based auth, logout is primarily handled client-side
    // by removing the token. This endpoint can be used for:
    // - Logging logout events
    // - Invalidating refresh tokens if stored server-side
    // - Performing cleanup operations
    
    // Optional: You can add token blacklisting or refresh token invalidation here
    // For now, we'll just return a success message
    
    return {
      success: true,
      message: 'Logout successful',
    };
  }
}
