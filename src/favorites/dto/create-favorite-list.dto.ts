import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavoriteListDto {
  @ApiProperty({
    description: 'List name',
    example: 'My Favorite Salons',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'List description',
    required: false,
    example: 'Best salons in the city',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'List color (hex color)',
    required: false,
    example: '#FF5733',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    description: 'List icon',
    required: false,
    example: 'star',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    description: 'Is this the default list?',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

