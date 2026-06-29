import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface FileUploadResult {
  storagePath: string;
  hashSha256: string;
  fileSizeBytes: number;
}

@Injectable()
export class StorageService {
  private logger = new Logger('StorageService');
  private uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('app.uploadDir') || './uploads';
  }

  /**
   * Upload a file to storage with UUID-based naming and SHA-256 hash generation
   * Files are organized by year/month subdirectories
   */
  async uploadFile(file: Express.Multer.File, subPath: string): Promise<FileUploadResult> {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // Generate directory path: uploadDir/year/month/subPath
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const dirPath = path.join(this.uploadDir, year, month, subPath);

      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });

      // Generate UUID-based filename to prevent guessing
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(dirPath, fileName);

      // Write file to disk
      await fs.writeFile(filePath, file.buffer);

      // Calculate SHA-256 hash
      const hash = crypto.createHash('sha256');
      hash.update(file.buffer);
      const hashSha256 = hash.digest('hex');

      // Build storage path (relative path for retrieval)
      const storagePath = path.join(year, month, subPath, fileName).replace(/\\/g, '/');

      this.logger.log(`File uploaded successfully: ${storagePath} (${file.size} bytes)`);

      return {
        storagePath,
        hashSha256,
        fileSizeBytes: file.size,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Retrieve a file from storage by its storage path
   */
  async getFile(storagePath: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadDir, storagePath);

      // Security check: ensure path is within upload directory
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(this.uploadDir);

      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        throw new Error('Invalid file path: access denied');
      }

      const buffer = await fs.readFile(filePath);
      this.logger.log(`File retrieved successfully: ${storagePath}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to retrieve file ${storagePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, storagePath);

      // Security check: ensure path is within upload directory
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(this.uploadDir);

      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        throw new Error('Invalid file path: access denied');
      }

      await fs.unlink(filePath);
      this.logger.log(`File deleted successfully: ${storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${storagePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify file integrity by comparing provided hash with stored file hash
   */
  async verifyFileHash(storagePath: string, expectedHash: string): Promise<boolean> {
    try {
      const buffer = await this.getFile(storagePath);
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      const calculatedHash = hash.digest('hex');
      return calculatedHash === expectedHash;
    } catch (error) {
      this.logger.error(`Failed to verify file hash: ${error.message}`);
      return false;
    }
  }

  /* Guardar un raw Buffer (e.g., generar PDF) en el storagePath especificado, creando directorios si es necesario */
  async saveFile(storagePath: string, buffer: Buffer): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, storagePath);

      // Crear directorio si no existe
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Escribir el archivo
      await fs.writeFile(filePath, buffer);

      this.logger.log(`File saved successfully: ${storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to save file ${storagePath}: ${error.message}`);
      throw error;
    }
  }
}
