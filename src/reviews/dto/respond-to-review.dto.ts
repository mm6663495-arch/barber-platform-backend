import { IsString, IsNotEmpty } from 'class-validator';

export class RespondToReviewDto {
  @IsString()
  @IsNotEmpty()
  response: string;
}
