import { IsNumber, IsString, IsOptional } from 'class-validator';

export class ProcessPaymentDto {
  @IsNumber()
  paymentId: number;

  @IsOptional()
  @IsString()
  stripeToken?: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;
}
