import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO لرفع صورة
 */
export class UploadImageDto {
  @ApiProperty({
    description: 'اسم بديل للصورة (اختياري)',
    example: 'salon-main-image',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  altText?: string;

  @ApiProperty({
    description: 'وصف الصورة (اختياري)',
    example: 'صورة واجهة الصالون',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'فئة الصورة',
    example: 'salon',
    required: false,
    enum: ['salon', 'profile', 'general', 'document'],
  })
  @IsOptional()
  @IsString()
  category?: string;
}

