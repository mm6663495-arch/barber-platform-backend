import { IsArray, IsString, IsNumber } from 'class-validator';

export class SendGeneralNotificationDto {
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];

  @IsString()
  title: string;

  @IsString()
  message: string;
}
