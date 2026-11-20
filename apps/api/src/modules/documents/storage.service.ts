import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';

import { Storage } from '@google-cloud/storage';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredFile {
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Where document files live: the environment's Cloud Storage bucket when GCS_BUCKET_NAME is
 * set (deployed environments; access through the API's service account), else a local folder
 * (development). Containers lose their disk on restart, so deployed environments must use the
 * bucket.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket;
  private readonly localDir: string;

  constructor(config: ConfigService) {
    const bucketName = config.get<string>('gcs.bucketName');
    this.bucket = bucketName ? new Storage().bucket(bucketName) : null;
    this.localDir = config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), '.uploads');
    if (!this.bucket) {
      if (config.get<string>('nodeEnv') === 'production') {
        throw new Error('GCS_BUCKET_NAME is required in production: local files would be lost on restart');
      }
      fs.mkdirSync(this.localDir, { recursive: true });
      this.logger.warn(`No GCS_BUCKET_NAME: documents are stored in ${this.localDir}`);
    }
  }

  async upload(file: Express.Multer.File, patientId: string): Promise<StoredFile> {
    // Random name: nothing about the patient or the file is guessable from the path
    const storagePath = `patients/${patientId}/${randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
    if (this.bucket) {
      await this.bucket.file(storagePath).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
      });
    } else {
      const target = this.localPath(storagePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.buffer);
    }
    this.logger.log(`Document stored: ${storagePath} (${file.size} bytes)`);
    return { storagePath, sizeBytes: file.size, mimeType: file.mimetype };
  }

  /** The file's content, to stream to the client. */
  async read(storagePath: string): Promise<Readable> {
    if (this.bucket) {
      const object = this.bucket.file(storagePath);
      const [exists] = await object.exists();
      if (!exists) throw new NotFoundException('Fichier introuvable sur le stockage');
      return object.createReadStream();
    }
    const target = this.localPath(storagePath);
    if (!fs.existsSync(target)) throw new NotFoundException('Fichier introuvable sur le stockage');
    return fs.createReadStream(target);
  }

  /** Resolves a stored path inside the local folder, refusing anything that would leave it. */
  private localPath(storagePath: string): string {
    const target = path.resolve(this.localDir, storagePath);
    if (!target.startsWith(path.resolve(this.localDir) + path.sep)) {
      throw new NotFoundException('Fichier introuvable sur le stockage');
    }
    return target;
  }
}
