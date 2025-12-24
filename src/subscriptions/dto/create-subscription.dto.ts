import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubscriptionDto {
  @IsNumber()
  packageId: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;
}
