# Noti

A Next.js TypeScript implementation of Noti - AI-powered audio transcription application with speaker diarization.

## Features

- 🎙️ Audio file upload with drag & drop support
- 🔒 Simple authentication (no password required)
- 📁 File-based storage (no database required)
- 🎯 TypeScript for type safety
- 🎨 Tailwind CSS with shadcn/ui components
- ⚡ Next.js 14 with App Router

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```bash
DATA_DIR=./data
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── login/             # Login page
│   └── page.tsx           # Main dashboard
├── components/            # React components
│   └── ui/               # UI components (shadcn/ui)
├── lib/                   # Utilities and services
│   ├── auth.ts           # Authentication
│   ├── fileDb.ts         # File-based storage
│   └── utils.ts          # Helper functions
└── middleware.ts         # Authentication middleware
```

## API Routes

- `POST /api/auth/login` - Login (no password required)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/check` - Check authentication status
- `GET /api/files` - List uploaded files
- `POST /api/upload` - Upload audio file
- `GET /api/health` - Health check

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## TODO

- [ ] Implement transcription service integration
- [ ] Add WebSocket/SSE for real-time transcription progress
- [ ] Implement AI summarization features
- [ ] Add mobile recording support
- [ ] Complete all API endpoints from SvelteKit version

## Notes

This is a simplified Next.js port focusing on core functionality. The file-based storage system allows running without a database, making it easy to deploy and self-host.