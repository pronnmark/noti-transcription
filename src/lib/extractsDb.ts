import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const EXTRACTS_DIR = join(DATA_DIR, 'extracts');
const EXTRACTS_INDEX_FILE = join(DATA_DIR, 'extracts_index.json');

export interface Extract {
  id: string;
  fileId: string;
  templateId?: string;
  templateName?: string;
  model: string;
  prompt: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface ExtractsIndex {
  [fileId: string]: string[]; // fileId -> array of extract IDs
}

async function initializeDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EXTRACTS_DIR, { recursive: true });
  
  try {
    await fs.access(EXTRACTS_INDEX_FILE);
  } catch {
    await fs.writeFile(EXTRACTS_INDEX_FILE, JSON.stringify({}));
  }
}

async function readExtractsIndex(): Promise<ExtractsIndex> {
  await initializeDirectories();
  try {
    const data = await fs.readFile(EXTRACTS_INDEX_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeExtractsIndex(index: ExtractsIndex): Promise<void> {
  await fs.writeFile(EXTRACTS_INDEX_FILE, JSON.stringify(index, null, 2));
}

// Create a new extract
export async function createExtract(
  fileId: string,
  prompt: string,
  model: string,
  templateId?: string,
  templateName?: string
): Promise<Extract> {
  await initializeDirectories();
  
  const extractId = uuidv4();
  const extract: Extract = {
    id: extractId,
    fileId,
    templateId,
    templateName,
    model,
    prompt,
    content: '',
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  // Save extract to file
  const extractPath = join(EXTRACTS_DIR, `${extractId}.json`);
  await fs.writeFile(extractPath, JSON.stringify(extract, null, 2));
  
  // Update index
  const index = await readExtractsIndex();
  if (!index[fileId]) {
    index[fileId] = [];
  }
  index[fileId].push(extractId);
  await writeExtractsIndex(index);
  
  return extract;
}

// Get extract by ID
export async function getExtract(extractId: string): Promise<Extract | null> {
  try {
    const extractPath = join(EXTRACTS_DIR, `${extractId}.json`);
    const data = await fs.readFile(extractPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Update extract
export async function updateExtract(extractId: string, updates: Partial<Extract>): Promise<void> {
  const extract = await getExtract(extractId);
  if (!extract) {
    throw new Error('Extract not found');
  }
  
  const updatedExtract = { ...extract, ...updates };
  const extractPath = join(EXTRACTS_DIR, `${extractId}.json`);
  await fs.writeFile(extractPath, JSON.stringify(updatedExtract, null, 2));
}

// Get all extracts for a file
export async function getExtractsForFile(fileId: string): Promise<Extract[]> {
  const index = await readExtractsIndex();
  const extractIds = index[fileId] || [];
  
  const extracts: Extract[] = [];
  for (const extractId of extractIds) {
    const extract = await getExtract(extractId);
    if (extract) {
      extracts.push(extract);
    }
  }
  
  // Sort by creation date, newest first
  return extracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Delete extract
export async function deleteExtract(extractId: string): Promise<void> {
  const extract = await getExtract(extractId);
  if (!extract) {
    throw new Error('Extract not found');
  }
  
  // Remove from index
  const index = await readExtractsIndex();
  if (index[extract.fileId]) {
    index[extract.fileId] = index[extract.fileId].filter(id => id !== extractId);
    if (index[extract.fileId].length === 0) {
      delete index[extract.fileId];
    }
    await writeExtractsIndex(index);
  }
  
  // Delete extract file
  const extractPath = join(EXTRACTS_DIR, `${extractId}.json`);
  try {
    await fs.unlink(extractPath);
  } catch {
    // File might not exist, ignore error
  }
}

// Get all extracts (for admin purposes)
export async function getAllExtracts(): Promise<Extract[]> {
  const index = await readExtractsIndex();
  const allExtractIds = Object.values(index).flat();
  
  const extracts: Extract[] = [];
  for (const extractId of allExtractIds) {
    const extract = await getExtract(extractId);
    if (extract) {
      extracts.push(extract);
    }
  }
  
  return extracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}