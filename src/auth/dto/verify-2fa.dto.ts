import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2FADto {
  @ApiProperty({ description: '2FA verification code' })
  @IsString()
  @MinLength(6)
  code: string;
}

