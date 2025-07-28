import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';

export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
}

export abstract class StorageService {
  protected basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure base directory exists
      const fullPath = this.getFullPath('');
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`Storage service initialized with base path: ${this.basePath}`);
    } catch (error) {
      console.error('Failed to initialize storage service:', error);
      throw error;
    }
  }

  abstract saveFile(path: string, data: Buffer): Promise<string>;
  abstract readFile(path: string): Promise<Buffer>;
  abstract deleteFile(path: string): Promise<boolean>;
  abstract fileExists(path: string): Promise<boolean>;

  async createDirectory(path: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(path);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`Directory created: ${path}`);
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  async listFiles(path: string): Promise<string[]> {
    try {
      const fullPath = this.getFullPath(path);

      if (!(await this.fileExists(path))) {
        return [];
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    } catch (error) {
      console.error(`Failed to list files in ${path}:`, error);
      throw error;
    }
  }

  async getFileStats(path: string): Promise<FileStats> {
    try {
      const fullPath = this.getFullPath(path);
      const stats = await fs.stat(fullPath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      console.error(`Failed to get file stats for ${path}:`, error);
      throw error;
    }
  }

  protected getFullPath(path: string): string {
    // Normalize path and ensure it's within base directory
    const normalizedPath = path.replace(/^\/+/, ''); // Remove leading slashes
    return join(this.basePath, normalizedPath);
  }

  protected validatePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new Error('Path is required and must be a string');
    }

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
    super(basePath);
  }

  async saveFile(path: string, data: Buffer): Promise<string> {
    try {
      this.validatePath(path);

      const fullPath = this.getFullPath(path);
      const directory = dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, data);

      console.log(`File saved: ${path} (${data.length} bytes)`);
      return fullPath;
    } catch (error) {
      console.error(`Failed to save file ${path}:`, error);
      throw error;
    }
  }

  async readFile(path: string): Promise<Buffer> {
    try {
      this.validatePath(path);

      const fullPath = this.getFullPath(path);
      const data = await fs.readFile(fullPath);

      console.log(`File read: ${path} (${data.length} bytes)`);
      return data;
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      this.validatePath(path);

      const fullPath = this.getFullPath(path);

      try {
        await fs.unlink(fullPath);
        console.log(`File deleted: ${path}`);
        return true;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.warn(`File not found for deletion: ${path}`);
          return false;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      throw error;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      this.validatePath(path);

      const fullPath = this.getFullPath(path);

      try {
        await fs.access(fullPath);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      console.error(`Failed to check file existence ${path}:`, error);
      return false;
    }
  }

  // Additional local storage methods
  async moveFile(fromPath: string, toPath: string): Promise<void> {
    try {
      this.validatePath(fromPath);
      this.validatePath(toPath);

      const fromFullPath = this.getFullPath(fromPath);
      const toFullPath = this.getFullPath(toPath);
      const toDirectory = dirname(toFullPath);

      // Ensure destination directory exists
      await fs.mkdir(toDirectory, { recursive: true });

      // Move file
      await fs.rename(fromFullPath, toFullPath);

      console.log(`File moved: ${fromPath} -> ${toPath}`);
    } catch (error) {
      console.error(`Failed to move file ${fromPath} -> ${toPath}:`, error);
      throw error;
    }
  }

  async copyFile(fromPath: string, toPath: string): Promise<void> {
    try {
      this.validatePath(fromPath);
      this.validatePath(toPath);

      const fromFullPath = this.getFullPath(fromPath);
      const toFullPath = this.getFullPath(toPath);
      const toDirectory = dirname(toFullPath);

      // Ensure destination directory exists
      await fs.mkdir(toDirectory, { recursive: true });

      // Copy file
      await fs.copyFile(fromFullPath, toFullPath);

      console.log(`File copied: ${fromPath} -> ${toPath}`);
    } catch (error) {
      console.error(`Failed to copy file ${fromPath} -> ${toPath}:`, error);
      throw error;
    }
  }

  async getDirectorySize(path: string = ''): Promise<number> {
    try {
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
    } catch (error) {
      console.error(`Failed to get directory size for ${path}:`, error);
      throw error;
    }
  }

  async cleanupOldFiles(path: string, maxAge: number): Promise<number> {
    try {
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
      console.log(`Cleaned up ${deletedCount} old files from ${path}`);

      return deletedCount;
    } catch (error) {
      console.error(`Failed to cleanup old files from ${path}:`, error);
      throw error;
    }
  }
}
