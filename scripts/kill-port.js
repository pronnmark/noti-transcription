#!/usr/bin/env node

const { execSync } = require('child_process');

const port = process.argv[2] || '5173';

try {
  // Try to find and kill processes on the specified port
  if (process.platform === 'linux' || process.platform === 'darwin') {
    // For Unix-based systems (Linux, macOS)
    try {
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: 'inherit' });
      console.log(`✅ Killed process on port ${port}`);
    } catch (e) {
      // No process found on port, which is fine
      console.log(`✅ Port ${port} is free`);
    }
  } else if (process.platform === 'win32') {
    // For Windows
    try {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      });
      
      pids.forEach(pid => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
          console.log(`✅ Killed process ${pid} on port ${port}`);
        } catch (e) {
          // Process might already be gone
        }
      });
    } catch (e) {
      console.log(`✅ Port ${port} is free`);
    }
  }
} catch (error) {
  console.error('Error checking port:', error.message);
}