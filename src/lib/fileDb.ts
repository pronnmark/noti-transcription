import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const AUDIO_FILES_DIR = path.join(DATA_DIR, 'audio_files');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptPath?: string;
  duration?: number;
  speakerCount?: number;
}

interface Metadata {
  audioFiles: Record<string, AudioFile>;
}

// Initialize directories
async function initializeDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(AUDIO_FILES_DIR, { recursive: true });
  await fs.mkdir(TRANSCRIPTS_DIR, { recursive: true });
  
  // Initialize metadata file if it doesn't exist
  try {
    await fs.access(METADATA_FILE);
  } catch {
    await fs.writeFile(METADATA_FILE, JSON.stringify({ audioFiles: {} }, null, 2));
  }
}

// Read metadata
async function readMetadata(): Promise<Metadata> {
  await initializeDirectories();
  const data = await fs.readFile(METADATA_FILE, 'utf-8');
  return JSON.parse(data);
}

// Write metadata
async function writeMetadata(metadata: Metadata) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// Create audio file record
export async function createAudioFile(
  filename: string,
  originalName: string,
  size: number,
  mimeType: string
): Promise<AudioFile> {
  const id = uuidv4();
  const audioFile: AudioFile = {
    id,
    filename,
    originalName,
    size,
    mimeType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transcriptionStatus: 'pending'
  };
  
  const metadata = await readMetadata();
  metadata.audioFiles[id] = audioFile;
  await writeMetadata(metadata);
  
  return audioFile;
}

// Get audio file by ID
export async function getAudioFile(id: string): Promise<AudioFile | null> {
  const metadata = await readMetadata();
  return metadata.audioFiles[id] || null;
}

// Get all audio files
export async function getAllAudioFiles(): Promise<AudioFile[]> {
  const metadata = await readMetadata();
  return Object.values(metadata.audioFiles).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Update audio file
export async function updateAudioFile(id: string, updates: Partial<AudioFile>) {
  const metadata = await readMetadata();
  if (metadata.audioFiles[id]) {
    metadata.audioFiles[id] = {
      ...metadata.audioFiles[id],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeMetadata(metadata);
  }
}

// Delete audio file
export async function deleteAudioFile(id: string) {
  const metadata = await readMetadata();
  const audioFile = metadata.audioFiles[id];
  
  if (audioFile) {
    // Delete physical files
    const audioPath = path.join(AUDIO_FILES_DIR, audioFile.filename);
    const transcriptPath = audioFile.transcriptPath ? 
      path.join(TRANSCRIPTS_DIR, audioFile.transcriptPath) : null;
    
    try {
      await fs.unlink(audioPath);
      if (transcriptPath) {
        await fs.unlink(transcriptPath);
      }
    } catch (error) {
      console.error('Error deleting files:', error);
    }
    
    // Remove from metadata
    delete metadata.audioFiles[id];
    await writeMetadata(metadata);
  }
}

// Save uploaded file
export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<AudioFile> {
  await initializeDirectories();
  
  const filename = `${uuidv4()}${path.extname(originalName)}`;
  const filepath = path.join(AUDIO_FILES_DIR, filename);
  
  await fs.writeFile(filepath, buffer);
  
  const audioFile = await createAudioFile(
    filename,
    originalName,
    buffer.length,
    mimeType
  );
  
  return audioFile;
}

// Get file path
export function getAudioFilePath(filename: string): string {
  return path.join(AUDIO_FILES_DIR, filename);
}

// Get transcript path
export function getTranscriptPath(filename: string): string {
  return path.join(TRANSCRIPTS_DIR, filename);
}

// Save transcript
export async function saveTranscript(audioFileId: string, transcript: unknown) {
  const transcriptFilename = `${audioFileId}.json`;
  const transcriptPath = path.join(TRANSCRIPTS_DIR, transcriptFilename);
  
  await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));
  
  await updateAudioFile(audioFileId, {
    transcriptPath: transcriptFilename,
    transcriptionStatus: 'completed'
  });
  
  return transcriptFilename;
}

// Update file status
export async function updateFileStatus(
  audioFileId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed'
) {
  const metadata = await readMetadata();
  const audioFile = metadata.audioFiles[audioFileId];
  
  if (!audioFile) {
    throw new Error('Audio file not found');
  }
  
  audioFile.transcriptionStatus = status;
  audioFile.updatedAt = new Date().toISOString();
  
  // If completed, set the transcript path
  if (status === 'completed') {
    audioFile.transcriptPath = `${audioFileId}.json`;
  }
  
  await writeMetadata(metadata);
}

// Get transcript
export async function getTranscript(audioFileId: string): Promise<unknown | null> {
  const audioFile = await getAudioFile(audioFileId);
  if (!audioFile || !audioFile.transcriptPath) return null;
  
  const transcriptPath = path.join(TRANSCRIPTS_DIR, audioFile.transcriptPath);
  try {
    const data = await fs.readFile(transcriptPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export { AUDIO_FILES_DIR, TRANSCRIPTS_DIR, DATA_DIR };