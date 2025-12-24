import { IsString, IsIn } from 'class-validator';

export class UpdateVisitStatusDto {
  @IsString()
  @IsIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
  status: string;
}

