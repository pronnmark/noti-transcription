# Development Setup

## Auto Port Management

The development server is configured to automatically kill any process running on port 5173 before starting. This prevents the common "port already in use" error.

### How it works

When you run `npm run dev`, it will:
1. First run `npm run kill-port` which executes `scripts/kill-port.js`
2. Kill any process currently using port 5173
3. Start the Next.js development server on port 5173

### Usage

Simply run:
```bash
npm run dev
```

The script will handle everything automatically, showing:
- ✅ Killed process on port 5173 (if a process was found)
- ✅ Port 5173 is free (if no process was using the port)

### Alternative methods

For Unix/Linux/macOS:
```bash
./scripts/dev.sh
```

For Windows:
```batch
scripts\dev.bat
```

### Manual port killing

If you need to manually kill the port:
```bash
npm run kill-port
```

Or directly:
```bash
# Linux/macOS
lsof -ti:5173 | xargs -r kill -9

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Troubleshooting

If the auto-kill doesn't work:
1. Make sure you have the necessary permissions
2. On Linux/macOS, you might need `sudo` for some processes
3. Close any terminals or IDEs that might be holding the port
4. As a last resort, restart your computer

The port management script supports:
- Linux ✅
- macOS ✅  
- Windows ✅