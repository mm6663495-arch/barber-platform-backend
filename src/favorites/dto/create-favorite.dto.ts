import { IsOptional, IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavoriteDto {
  @ApiProperty({
    description: 'Salon ID (required if packageId is not provided)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  salonId?: number;

  @ApiProperty({
    description: 'Package ID (required if salonId is not provided)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  packageId?: number;

  @ApiProperty({
    description: 'Favorite list ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  listId?: number;

  @ApiProperty({
    description: 'Custom notes for the favorite',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

