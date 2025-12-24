import { IsString, IsOptional } from 'class-validator';

export class UseVisitDto {
  @IsString()
  qrCode: string;

  @IsOptional()
  @IsString()
  serviceName?: string; // ⭐ اسم الخدمة المختارة
}
