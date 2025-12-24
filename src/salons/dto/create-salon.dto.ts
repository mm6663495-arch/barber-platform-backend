import { IsString, IsOptional, IsNumber, IsArray, IsObject } from 'class-validator';

export class CreateSalonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, any>;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  logo?: string;
}
