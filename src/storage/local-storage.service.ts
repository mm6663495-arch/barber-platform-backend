import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { networkInterfaces } from 'os';

export interface LocalUploadResult {
  url: string;
  key: string;
  bucket: string;
  cdnUrl?: string;
  size: number;
  contentType: string;
}

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // تحديد مجلد الرفع (uploads في جذر المشروع)
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    // تحديد base URL للوصول إلى الملفات
    const port = this.configService.get<number>('PORT') || 3000;
    
    // محاولة الحصول على IP المحلي للشبكة (للوصول من الموبايل)
    const nets = networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // البحث عن IPv4 غير داخلي (ليس 127.0.0.1 أو ::1)
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }
    
    // استخدام IP المحلي إذا وُجد، وإلا localhost
    // في بيئة التطوير، يمكن استخدام IP المحلي للوصول من الموبايل
    const baseHost = process.env.NODE_ENV === 'production' ? 'localhost' : localIP;
    this.baseUrl = `http://${baseHost}:${port}/uploads`;
    
    // إنشاء مجلد uploads إذا لم يكن موجوداً
    this.ensureUploadsDirectory();
    
    this.logger.log(`Local Storage initialized: ${this.uploadsDir}`);
    this.logger.log(`Base URL: ${this.baseUrl}`);
    this.logger.log(`Local IP detected: ${localIP}`);
  }

  private async ensureUploadsDirectory() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
    }
  }

  /**
   * رفع ملف إلى التخزين المحلي
   */
  async uploadFile(
    file: Buffer | Uint8Array,
    fileName: string,
    contentType: string,
    folder?: string,
  ): Promise<LocalUploadResult> {
    try {
      // إنشاء اسم فريد للملف
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${crypto.randomUUID()}${fileExtension}`;
      
      // تحديد المسار الكامل
      const folderPath = folder ? path.join(this.uploadsDir, folder) : this.uploadsDir;
      await fs.mkdir(folderPath, { recursive: true });
      
      const filePath = path.join(folderPath, uniqueFileName);
      
      // كتابة الملف
      await fs.writeFile(filePath, file);
      
      // ⚠️ التحقق من أن الملف تم حفظه بنجاح
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`Failed to save file: ${filePath}`);
      }
      
      // إنشاء URL للملف (نسبي فقط - الفرونت إند سيتعامل معه)
      const relativePath = folder 
        ? `/uploads/${folder}/${uniqueFileName}` 
        : `/uploads/${uniqueFileName}`;
      
      // ⚠️ إرجاع URL نسبي فقط (بدون IP) - الفرونت إند سيتعامل معه
      // هذا يضمن أن URLs تعمل بغض النظر عن IP الكمبيوتر
      this.logger.log(`✅ [LOCAL STORAGE] File uploaded successfully:`);
      this.logger.log(`  - Physical path: ${filePath}`);
      this.logger.log(`  - Relative URL: ${relativePath}`);
      this.logger.log(`  - File size: ${file.length} bytes`);
      this.logger.log(`  - File exists: ${fileExists}`);
      
      return {
        url: relativePath, // ✅ URL نسبي فقط
        key: relativePath,
        bucket: 'local',
        size: file.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file locally: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف ملف
   */
  async deleteFile(key: string): Promise<void> {
    try {
      // key يأتي كـ "/folder/file.jpg" أو "/file.jpg"
      const filePath = path.join(this.uploadsDir, key);
      await fs.unlink(filePath);
      this.logger.log(`File deleted: ${filePath}`);
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
      this.logger.log(`${keys.length} files deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete files: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * استخراج key من URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // إزالة "/uploads" من البداية
      if (pathname.startsWith('/uploads')) {
        return pathname.replace('/uploads', '');
      }
      return pathname;
    } catch {
      return null;
    }
  }

  /**
   * التحقق من وجود الملف
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      // إزالة /uploads من البداية إذا كان موجوداً
      const cleanKey = key.startsWith('/uploads/') 
        ? key.replace('/uploads/', '') 
        : key.startsWith('uploads/')
        ? key.replace('uploads/', '')
        : key;
      
      const filePath = path.join(this.uploadsDir, cleanKey);
      await fs.access(filePath);
      this.logger.log(`File exists: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.warn(`File does not exist: ${key}`);
      return false;
    }
  }
  
  /**
   * الحصول على المسار الكامل للملف
   */
  getFilePath(key: string): string {
    // إزالة /uploads من البداية إذا كان موجوداً
    const cleanKey = key.startsWith('/uploads/') 
      ? key.replace('/uploads/', '') 
      : key.startsWith('uploads/')
      ? key.replace('uploads/', '')
      : key;
    
    return path.join(this.uploadsDir, cleanKey);
  }
}

