import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2FADto {
  @ApiProperty({
    description: '6-digit code from Google Authenticator',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Token must be 6 digits' })
  token: string;
}

export class Verify2FADto {
  @ApiProperty({
    description: '6-digit code from Google Authenticator or 8-character backup code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class Disable2FADto {
  @ApiProperty({
    description: 'User password for verification',
    example: 'MySecurePassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class RegenerateBackupCodesDto {
  @ApiProperty({
    description: '6-digit code from Google Authenticator',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Token must be 6 digits' })
  token: string;
}

