import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AudioFile, TranscriptSegment } from '../db/sqliteSchema';

const DATA_DIR = process.env.DATA_DIR || './data';
const METADATA_FILE = join(DATA_DIR, 'metadata.json');

interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  duration?: number;
}

interface MetadataStore {
  files: Record<string, FileMetadata>;
}

// Ensure data directory exists
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(join(DATA_DIR, 'audio_files'), { recursive: true });
  await fs.mkdir(join(DATA_DIR, 'transcripts'), { recursive: true });
}

// Load metadata
async function loadMetadata(): Promise<MetadataStore> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { files: {} };
  }
}

// Save metadata
async function saveMetadata(metadata: MetadataStore) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// Convert file metadata to AudioFile format
function fileMetadataToAudioFile(meta: FileMetadata): Partial<AudioFile> {
  // Generate a numeric ID from the string ID for compatibility
  const numericId = meta.id.split('-')[0].split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return {
    id: numericId,
    fileName: meta.filename,
    originalFileName: meta.originalName,
    fileSize: meta.size,
    originalFileType: meta.mimeType,
    transcriptionStatus: meta.transcriptionStatus || 'pending',
    duration: meta.duration,
    uploadedAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

export const fileService = {
  async getAllFiles(): Promise<Partial<AudioFile>[]> {
    const metadata = await loadMetadata();
    if (!metadata.files) {
      return [];
    }
    return Object.values(metadata.files).map(fileMetadataToAudioFile);
  },

  async createFile(data: {
    fileName: string;
    originalFileName: string;
    originalFileType: string;
    fileSize: number;
  }): Promise<Partial<AudioFile>> {
    const metadata = await loadMetadata();
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Ensure files object exists
    if (!metadata.files) {
      metadata.files = {};
    }
    
    const fileData: FileMetadata = {
      id,
      filename: data.fileName,
      originalName: data.originalFileName,
      size: data.fileSize,
      mimeType: data.originalFileType,
      createdAt: now,
      updatedAt: now,
      transcriptionStatus: 'pending',
    };
    
    metadata.files[id] = fileData;
    await saveMetadata(metadata);
    
    return fileMetadataToAudioFile(fileData);
  },

  async updateFileStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed') {
    const metadata = await loadMetadata();
    if (!metadata.files) {
      metadata.files = {};
    }
    if (metadata.files[id]) {
      metadata.files[id].transcriptionStatus = status;
      metadata.files[id].updatedAt = new Date().toISOString();
      await saveMetadata(metadata);
    }
  },

  async updateFileTranscript(id: string, segments: TranscriptSegment[]) {
    const transcriptPath = join(DATA_DIR, 'transcripts', `${id}.json`);
    await fs.writeFile(transcriptPath, JSON.stringify({ segments }, null, 2));
    
    const metadata = await loadMetadata();
    if (!metadata.files) {
      metadata.files = {};
    }
    if (metadata.files[id]) {
      metadata.files[id].transcriptionStatus = 'completed';
      metadata.files[id].updatedAt = new Date().toISOString();
      await saveMetadata(metadata);
    }
  },

  async getTranscript(id: string): Promise<{ segments: TranscriptSegment[] } | null> {
    try {
      const transcriptPath = join(DATA_DIR, 'transcripts', `${id}.json`);
      const data = await fs.readFile(transcriptPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
};