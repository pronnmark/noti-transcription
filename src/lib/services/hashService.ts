import { createHash } from 'crypto';
import { promises as fs } from 'fs';

export class HashService {
  /**
   * Generate SHA-256 hash from a buffer
   * @param buffer - File buffer
   * @returns SHA-256 hash as hex string
   */
  static generateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate SHA-256 hash from a file path
   * @param filePath - Path to file
   * @returns SHA-256 hash as hex string
   */
  static async hashFile(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return this.generateHash(fileBuffer);
    } catch (error) {
      console.error('Error hashing file:', error);
      throw new Error(`Failed to hash file: ${filePath}`);
    }
  }

  /**
   * Verify if a buffer matches the expected hash
   * @param buffer - File buffer
   * @param expectedHash - Expected SHA-256 hash
   * @returns True if hashes match
   */
  static verifyHash(buffer: Buffer, expectedHash: string): boolean {
    const actualHash = this.generateHash(buffer);
    return actualHash === expectedHash;
  }

  /**
   * Generate a combination key for filename + size duplicate detection
   * @param filename - Original filename
   * @param size - File size in bytes
   * @returns Combined key string
   */
  static generateFilenameKey(filename: string, size: number): string {
    const normalizedName = filename.toLowerCase().trim();
    return `${normalizedName}_${size}`;
  }
}
