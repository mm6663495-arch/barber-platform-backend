import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  cdnUrl?: string;
  size: number;
  contentType: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnUrl?: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'default-bucket';
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.cdnUrl = this.configService.get<string>('AWS_CLOUDFRONT_URL');

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`S3 Service initialized with bucket: ${this.bucket}`);
  }

  /**
   * رفع ملف إلى S3
   */
  async uploadFile(
    file: Buffer | Uint8Array | string,
    fileName: string,
    contentType: string,
    folder?: string,
  ): Promise<UploadResult> {
    try {
      const key = this.generateKey(fileName, folder);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: contentType,
          ACL: 'public-read', // أو 'private' حسب الحاجة
          CacheControl: 'max-age=31536000', // سنة واحدة
        },
      });

      await upload.done();

      const s3Url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      const cdnUrl = this.cdnUrl ? `${this.cdnUrl}/${key}` : undefined;

      const size = Buffer.isBuffer(file) ? file.length : file.length;

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        url: s3Url,
        key,
        bucket: this.bucket,
        cdnUrl,
        size,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * رفع ملف من stream
   */
  async uploadStream(
    stream: NodeJS.ReadableStream | Buffer | Uint8Array,
    fileName: string,
    contentType: string,
    folder?: string,
  ): Promise<UploadResult> {
    try {
      const key = this.generateKey(fileName, folder);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream as any,
          ContentType: contentType,
          ACL: 'public-read',
          CacheControl: 'max-age=31536000',
        },
      });

      const result = await upload.done();

      const s3Url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      const cdnUrl = this.cdnUrl ? `${this.cdnUrl}/${key}` : undefined;

      this.logger.log(`Stream uploaded successfully: ${key}`);

      return {
        url: s3Url,
        key,
        bucket: this.bucket,
        cdnUrl,
        size: 0, // لا يمكن معرفة الحجم من stream
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload stream: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف ملف من S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف عدة ملفات
   */
  async deleteFiles(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.deleteFile(key)));
      this.logger.log(`${keys.length} files deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete files: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * التحقق من وجود ملف
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * الحصول على رابط موقّع للملف (temporary URL)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * الحصول على قائمة الملفات في مجلد
   */
  async listFiles(folder: string, maxKeys: number = 1000): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: folder,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);
      return response.Contents?.map((item) => item.Key).filter((key): key is string => key !== undefined) || [];
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * نسخ ملف
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: sourceKey,
      });

      const response = await this.s3Client.send(getCommand);
      
      // تحويل Body إلى Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const bodyContents = Buffer.concat(chunks);

      await this.uploadFile(
        bodyContents,
        path.basename(destinationKey),
        response.ContentType || 'application/octet-stream',
        path.dirname(destinationKey),
      );

      this.logger.log(`File copied from ${sourceKey} to ${destinationKey}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * توليد key فريد للملف
   */
  private generateKey(fileName: string, folder?: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, extension);
    const sanitizedName = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);

    const key = `${sanitizedName}-${timestamp}-${randomString}${extension}`;

    return folder ? `${folder}/${key}` : key;
  }

  /**
   * استخراج key من URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // S3 URL
      if (url.includes('.s3.')) {
        const urlParts = url.split('.s3.');
        const pathPart = urlParts[1].split('/').slice(1).join('/');
        return pathPart;
      }

      // CloudFront URL
      if (this.cdnUrl && url.startsWith(this.cdnUrl)) {
        return url.replace(this.cdnUrl + '/', '');
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to extract key from URL: ${error.message}`);
      return null;
    }
  }

  /**
   * الحصول على CDN URL
   */
  getCdnUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

