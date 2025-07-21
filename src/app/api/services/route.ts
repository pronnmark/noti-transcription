import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: "Services API temporarily simplified",
    services: ["audio", "transcription", "extraction", "gemini"],
    status: "healthy"
  });
}

export async function POST() {
  return NextResponse.json({
    message: "Service management temporarily disabled"
  });
}

export async function PUT() {
  return NextResponse.json({
    message: "Service configuration temporarily disabled"
  });
}