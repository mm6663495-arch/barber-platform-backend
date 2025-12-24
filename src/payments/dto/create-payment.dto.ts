import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  subscriptionId: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  paymentMethod: string;
}
