import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreBackupDto {
  @ApiProperty({ description: 'Backup ID to restore from' })
  @IsString()
  @IsNotEmpty()
  backupId: string;
}

