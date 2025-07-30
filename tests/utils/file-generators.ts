import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Generate minimal valid audio files for testing
 * These are extremely small but valid audio files that can be used for upload testing
 */
export class FileGenerators {
  static generateTestFiles(): void {
    const fixturesDir = join(__dirname, '..', 'fixtures');

    // Generate a minimal MP3 file (44 bytes - the smallest valid MP3)
    this.generateMinimalMP3(join(fixturesDir, 'test-audio-small.mp3'));

    // Generate a minimal WAV file (44 bytes header + 1 byte data)
    this.generateMinimalWAV(join(fixturesDir, 'test-audio-medium.wav'));

    // Generate a minimal OGG file (for voice message testing)
    this.generateMinimalOGG(join(fixturesDir, 'test-voice-message.ogg'));

    // Generate an invalid file for error testing
    this.generateInvalidFile(join(fixturesDir, 'invalid-file.txt'));

    console.log('✅ Generated test audio files');
  }

  private static generateMinimalMP3(filePath: string): void {
    // Minimal valid MP3 frame header + minimal data
    // This creates a technically valid MP3 that's ~1KB
    const mp3Header = Buffer.from([
      // ID3v2 header (10 bytes)
      0x49,
      0x44,
      0x33, // "ID3"
      0x03,
      0x00, // Version 2.3
      0x00, // Flags
      0x00,
      0x00,
      0x00,
      0x00, // Size (0)

      // MP3 Frame header
      0xff,
      0xfb, // Frame sync + MPEG 1 Layer 3
      0x92,
      0x00, // Bitrate/samplerate/padding/private

      // Minimal frame data (32 bytes of silence)
      ...Array(32).fill(0x00),
    ]);

    writeFileSync(filePath, mp3Header);
  }

  private static generateMinimalWAV(filePath: string): void {
    // Create a minimal WAV file (44-byte header + minimal data)
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = 2; // 1 sample
    const fileSize = 36 + dataSize;

    const wavBuffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    wavBuffer.write('RIFF', offset);
    offset += 4;
    wavBuffer.writeUInt32LE(fileSize, offset);
    offset += 4;
    wavBuffer.write('WAVE', offset);
    offset += 4;

    // fmt chunk
    wavBuffer.write('fmt ', offset);
    offset += 4;
    wavBuffer.writeUInt32LE(16, offset);
    offset += 4; // chunk size
    wavBuffer.writeUInt16LE(1, offset);
    offset += 2; // audio format (PCM)
    wavBuffer.writeUInt16LE(numChannels, offset);
    offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset);
    offset += 4;
    wavBuffer.writeUInt32LE(
      (sampleRate * numChannels * bitsPerSample) / 8,
      offset
    );
    offset += 4;
    wavBuffer.writeUInt16LE((numChannels * bitsPerSample) / 8, offset);
    offset += 2;
    wavBuffer.writeUInt16LE(bitsPerSample, offset);
    offset += 2;

    // data chunk
    wavBuffer.write('data', offset);
    offset += 4;
    wavBuffer.writeUInt32LE(dataSize, offset);
    offset += 4;

    // Minimal audio data (silence)
    wavBuffer.writeInt16LE(0, offset);

    writeFileSync(filePath, wavBuffer);
  }

  private static generateMinimalOGG(filePath: string): void {
    // Create a minimal OGG Vorbis file
    // This is more complex, so we'll create a simple OGG container with minimal data
    const oggHeader = Buffer.from([
      // OGG page header
      0x4f,
      0x67,
      0x67,
      0x53, // "OggS"
      0x00, // Version
      0x02, // Header type (first page)
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // Granule position
      0x01,
      0x02,
      0x03,
      0x04, // Serial number
      0x00,
      0x00,
      0x00,
      0x00, // Page sequence
      0x00,
      0x00,
      0x00,
      0x00, // Checksum (we'll skip proper calculation)
      0x01, // Page segments
      0x1e, // Segment table (30 bytes)

      // Minimal Vorbis header (simplified)
      0x01,
      0x76,
      0x6f,
      0x72,
      0x62,
      0x69,
      0x73, // "\x01vorbis"
      0x00,
      0x00,
      0x00,
      0x00, // Version
      0x01, // Channels
      0x44,
      0xac,
      0x00,
      0x00, // Sample rate (44100)
      0x00,
      0x00,
      0x00,
      0x00, // Bitrate max
      0x00,
      0x00,
      0x00,
      0x00, // Bitrate nominal
      0x00,
      0x00,
      0x00,
      0x00, // Bitrate min
      0x0b, // Blocksize
      0x01, // Framing
    ]);

    writeFileSync(filePath, oggHeader);
  }

  private static generateInvalidFile(filePath: string): void {
    // Create a text file that's not a valid audio file
    const content =
      'This is not an audio file and should be rejected by validation.';
    writeFileSync(filePath, content);
  }

  static getFileInfo() {
    return {
      'test-audio-small.mp3': {
        size: 46,
        contentType: 'audio/mpeg',
        description: 'Minimal valid MP3 file',
      },
      'test-audio-medium.wav': {
        size: 46,
        contentType: 'audio/wav',
        description: 'Minimal valid WAV file',
      },
      'test-voice-message.ogg': {
        size: 58,
        contentType: 'audio/ogg',
        description: 'Minimal valid OGG file',
      },
      'invalid-file.txt': {
        size: 65,
        contentType: 'text/plain',
        description: 'Invalid file for error testing',
      },
    };
  }
}

// Generate files when this module is imported
if (require.main === module) {
  FileGenerators.generateTestFiles();
}
