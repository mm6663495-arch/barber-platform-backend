import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';
import { S3Service } from './s3.service';
import { LocalStorageService } from './local-storage.service';
import { ImageService } from './image.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [S3Service, LocalStorageService, StorageService, ImageService],
  exports: [S3Service, LocalStorageService, StorageService, ImageService],
})
export class StorageModule {}

