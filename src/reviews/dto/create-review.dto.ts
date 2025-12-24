import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsOptional()
  @IsNumber()
  visitId?: number;

  @IsOptional()
  @IsNumber()
  packageId?: number;

  @IsOptional()
  @IsNumber()
  salonId?: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
