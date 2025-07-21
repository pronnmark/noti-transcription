import { NextRequest, NextResponse } from "next/server";
import { ApiServices } from '../../../lib/api/ApiHandler';

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    
    // Test file properties
    const fileInfo = {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      hasArrayBuffer: typeof file?.arrayBuffer === 'function',
      hasStream: typeof file?.stream === 'function',
      constructor: file?.constructor?.name,
      prototypeChain: file ? Object.getPrototypeOf(file).constructor.name : null
    };

    // Try to read file data
    let bufferSize = 0;
    let bufferError = null;
    
    if (file) {
      try {
        if (typeof file.arrayBuffer === 'function') {
          const buffer = await file.arrayBuffer();
          bufferSize = buffer.byteLength;
        } else if (typeof file.stream === 'function') {
          const chunks: Uint8Array[] = [];
          const reader = file.stream().getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
          bufferSize = buffer.length;
        } else {
          bufferError = 'No arrayBuffer or stream method available';
        }
      } catch (error) {
        bufferError = error instanceof Error ? error.message : String(error);
      }
    }

    // Test service availability
    const serviceStatus = {
      fileUpload: !!ApiServices.fileUpload,
      audio: !!ApiServices.audio,
      transcription: !!ApiServices.transcription,
    };

    return NextResponse.json({
      success: true,
      fileInfo,
      bufferSize,
      bufferError,
      serviceStatus,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}