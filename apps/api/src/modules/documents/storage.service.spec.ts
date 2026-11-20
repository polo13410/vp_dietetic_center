import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bucketFile = { save: vi.fn(), exists: vi.fn(), createReadStream: vi.fn() };
const bucket = { file: vi.fn(() => bucketFile) };
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(function Storage() {
    return { bucket: vi.fn(() => bucket) };
  }),
}));

import { StorageService } from './storage.service';

const config = (values: Record<string, string | undefined>) => ({ get: (key: string) => values[key] }) as any;
const file = (name: string) =>
  ({ originalname: name, buffer: Buffer.from('%PDF-1.4 test'), size: 13, mimetype: 'application/pdf' }) as any;

const readAll = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
};

describe('StorageService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('without a bucket (development)', () => {
    let dir: string;
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-docs-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('stores the file under a random name in the patient folder, and reads it back', async () => {
      const storage = new StorageService(config({ UPLOAD_DIR: dir }));
      const stored = await storage.upload(file('Bilan sanguin Marie.PDF'), 'p1');

      expect(stored.storagePath).toMatch(/^patients\/p1\/[0-9a-f-]{36}\.pdf$/);
      expect(stored.storagePath).not.toContain('Marie');
      expect(await readAll(await storage.read(stored.storagePath))).toBe('%PDF-1.4 test');
    });

    it('refuses paths that leave the storage folder', async () => {
      const storage = new StorageService(config({ UPLOAD_DIR: dir }));
      await expect(storage.read('../../etc/passwd')).rejects.toThrow(NotFoundException);
      await expect(storage.read('patients/p1/missing.pdf')).rejects.toThrow(NotFoundException);
    });

    it('refuses to start in production, where the disk is lost on restart', () => {
      expect(() => new StorageService(config({ nodeEnv: 'production', UPLOAD_DIR: dir }))).toThrow(
        /GCS_BUCKET_NAME/,
      );
    });
  });

  describe('with a bucket', () => {
    const storage = () => new StorageService(config({ 'gcs.bucketName': 'docs', nodeEnv: 'production' }));

    it('saves the file in the bucket with its content type', async () => {
      const stored = await storage().upload(file('scan.pdf'), 'p1');
      expect(bucket.file).toHaveBeenCalledWith(stored.storagePath);
      expect(bucketFile.save).toHaveBeenCalledWith(expect.any(Buffer), {
        contentType: 'application/pdf',
        resumable: false,
      });
    });

    it('streams an existing file, and reports a missing one', async () => {
      const stream = { pipe: vi.fn() };
      bucketFile.exists.mockResolvedValueOnce([true]);
      bucketFile.createReadStream.mockReturnValueOnce(stream);
      await expect(storage().read('patients/p1/a.pdf')).resolves.toBe(stream);

      bucketFile.exists.mockResolvedValueOnce([false]);
      await expect(storage().read('patients/p1/b.pdf')).rejects.toThrow(NotFoundException);
    });
  });
});
