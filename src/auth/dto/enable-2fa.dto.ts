import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2FADto {
  @ApiProperty({ description: 'Verification code from authenticator app' })
  @IsString()
  @MinLength(6)
  code: string;
}

