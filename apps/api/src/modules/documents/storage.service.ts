import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') || path.join('/tmp', 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    file: Express.Multer.File,
    patientId: string,
  ): Promise<{ storagePath: string; sizeBytes: number; mimeType: string }> {
    const fileName = `${patientId}/${Date.now()}-${this.sanitize(file.originalname)}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Ensure patient directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.buffer);
    this.logger.log(`File uploaded: ${fileName} (${file.size} bytes)`);

    return {
      storagePath: fileName,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }

  async getFilePath(storagePath: string): Promise<string> {
    const filePath = path.join(this.uploadDir, storagePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${storagePath}`);
    }
    return filePath;
  }

  async delete(storagePath: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted: ${storagePath}`);
    }
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
