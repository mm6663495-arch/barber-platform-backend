import { IsString, IsNotEmpty } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
