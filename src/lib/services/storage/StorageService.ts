import { BaseService, ValidationRules } from '../core/BaseService';
import type { IStorageService, FileStats } from '../core/interfaces';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';

export abstract class StorageService extends BaseService implements IStorageService {
  protected basePath: string;

  constructor(name: string, basePath: string) {
    super(name);
    this.basePath = basePath;
  }

  protected async onInitialize(): Promise<void> {
    // Ensure base directory exists - use direct fs call to avoid circular dependency
    const fullPath = this.getFullPath('');
    await fs.mkdir(fullPath, { recursive: true });
    this._logger.info(`Storage service initialized with base path: ${this.basePath}`);
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Storage service destroyed');
  }

  abstract saveFile(path: string, data: Buffer): Promise<string>;
  abstract readFile(path: string): Promise<Buffer>;
  abstract deleteFile(path: string): Promise<boolean>;
  abstract fileExists(path: string): Promise<boolean>;

  async createDirectory(path: string): Promise<void> {
    return this.executeWithErrorHandling(`createDirectory(${path})`, async () => {
      const fullPath = this.getFullPath(path);
      await fs.mkdir(fullPath, { recursive: true });
    });
  }

  async listFiles(path: string): Promise<string[]> {
    return this.executeWithErrorHandling(`listFiles(${path})`, async () => {
      const fullPath = this.getFullPath(path);
      
      if (!(await this.fileExists(path))) {
        return [];
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    });
  }

  async getFileStats(path: string): Promise<FileStats> {
    return this.executeWithErrorHandling(`getFileStats(${path})`, async () => {
      const fullPath = this.getFullPath(path);
      const stats = await fs.stat(fullPath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
      };
    });
  }

  protected getFullPath(path: string): string {
    // Normalize path and ensure it's within base directory
    const normalizedPath = path.replace(/^\/+/, ''); // Remove leading slashes
    return join(this.basePath, normalizedPath);
  }

  protected validatePath(path: string): void {
    this.validateInput(path, [
      ValidationRules.required('path'),
      ValidationRules.isString('path'),
    ]);

    // Security check: prevent path traversal
    const normalizedPath = path.replace(/^\/+/, '');
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new Error('Invalid path: path traversal not allowed');
    }
  }

  protected generateUniqueFileName(originalName: string, directory: string = ''): string {
    const ext = extname(originalName);
    const nameWithoutExt = basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${nameWithoutExt}_${timestamp}_${random}${ext}`;
  }

  protected async generateFileHash(data: Buffer): Promise<string> {
    return createHash('sha256').update(data).digest('hex');
  }
}

// Local file system implementation
export class LocalStorageService extends StorageService {
  constructor(basePath: string = './data') {
    super('LocalStorage', basePath);
  }

  async saveFile(path: string, data: Buffer): Promise<string> {
    return this.executeWithErrorHandling(`saveFile(${path})`, async () => {
      this.validatePath(path);
      
      const fullPath = this.getFullPath(path);
      const directory = dirname(fullPath);
      
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, data);
      
      this._logger.info(`File saved: ${path} (${data.length} bytes)`);
      return fullPath;
    });
  }

  async readFile(path: string): Promise<Buffer> {
    return this.executeWithErrorHandling(`readFile(${path})`, async () => {
      this.validatePath(path);
      
      const fullPath = this.getFullPath(path);
      const data = await fs.readFile(fullPath);
      
      this._logger.debug(`File read: ${path} (${data.length} bytes)`);
      return data;
    });
  }

  async deleteFile(path: string): Promise<boolean> {
    return this.executeWithErrorHandling(`deleteFile(${path})`, async () => {
      this.validatePath(path);
      
      const fullPath = this.getFullPath(path);
      
      try {
        await fs.unlink(fullPath);
        this._logger.info(`File deleted: ${path}`);
        return true;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          this._logger.warn(`File not found for deletion: ${path}`);
          return false;
        }
        throw error;
      }
    });
  }

  async fileExists(path: string): Promise<boolean> {
    return this.executeWithErrorHandling(`fileExists(${path})`, async () => {
      this.validatePath(path);
      
      const fullPath = this.getFullPath(path);
      
      try {
        await fs.access(fullPath);
        return true;
      } catch {
        return false;
      }
    });
  }

  // Additional local storage methods
  async moveFile(fromPath: string, toPath: string): Promise<void> {
    return this.executeWithErrorHandling(`moveFile(${fromPath} -> ${toPath})`, async () => {
      this.validatePath(fromPath);
      this.validatePath(toPath);
      
      const fromFullPath = this.getFullPath(fromPath);
      const toFullPath = this.getFullPath(toPath);
      const toDirectory = dirname(toFullPath);
      
      // Ensure destination directory exists
      await fs.mkdir(toDirectory, { recursive: true });
      
      // Move file
      await fs.rename(fromFullPath, toFullPath);
      
      this._logger.info(`File moved: ${fromPath} -> ${toPath}`);
    });
  }

  async copyFile(fromPath: string, toPath: string): Promise<void> {
    return this.executeWithErrorHandling(`copyFile(${fromPath} -> ${toPath})`, async () => {
      this.validatePath(fromPath);
      this.validatePath(toPath);
      
      const fromFullPath = this.getFullPath(fromPath);
      const toFullPath = this.getFullPath(toPath);
      const toDirectory = dirname(toFullPath);
      
      // Ensure destination directory exists
      await fs.mkdir(toDirectory, { recursive: true });
      
      // Copy file
      await fs.copyFile(fromFullPath, toFullPath);
      
      this._logger.info(`File copied: ${fromPath} -> ${toPath}`);
    });
  }

  async getDirectorySize(path: string = ''): Promise<number> {
    return this.executeWithErrorHandling(`getDirectorySize(${path})`, async () => {
      const fullPath = this.getFullPath(path);
      
      const calculateSize = async (dirPath: string): Promise<number> => {
        let totalSize = 0;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = join(dirPath, entry.name);
          
          if (entry.isFile()) {
            const stats = await fs.stat(entryPath);
            totalSize += stats.size;
          } else if (entry.isDirectory()) {
            totalSize += await calculateSize(entryPath);
          }
        }
        
        return totalSize;
      };
      
      return await calculateSize(fullPath);
    });
  }

  async cleanupOldFiles(path: string, maxAge: number): Promise<number> {
    return this.executeWithErrorHandling(`cleanupOldFiles(${path}, ${maxAge}ms)`, async () => {
      const fullPath = this.getFullPath(path);
      const cutoffTime = Date.now() - maxAge;
      let deletedCount = 0;
      
      const cleanup = async (dirPath: string): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = join(dirPath, entry.name);
          
          if (entry.isFile()) {
            const stats = await fs.stat(entryPath);
            if (stats.mtime.getTime() < cutoffTime) {
              await fs.unlink(entryPath);
              deletedCount++;
            }
          } else if (entry.isDirectory()) {
            await cleanup(entryPath);
          }
        }
      };
      
      await cleanup(fullPath);
      this._logger.info(`Cleaned up ${deletedCount} old files from ${path}`);
      
      return deletedCount;
    });
  }
}
