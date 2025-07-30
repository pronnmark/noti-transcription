# Whisper.cpp Production Integration Guide

## 🚀 Container Management

### Start the Container

```bash
# Start with docker-compose (recommended)
docker-compose up -d

# Or start directly
docker run -d --name whisper-swedish-turbo \
  --gpus all \
  -v $(pwd)/models:/models:ro \
  -v $(pwd)/audio:/audio:ro \
  -p 8080:8080 \
  ghcr.io/ggml-org/whisper.cpp:main-cuda \
  "./build/bin/whisper-server --host 0.0.0.0 --port 8080 --model /models/ggml-large-v3-turbo.bin --language sv --diarize --convert"
```

### Container Status & Health

```bash
# Check container status
docker ps | grep whisper

# View logs
docker logs whisper-swedish-turbo

# Health check
curl http://localhost:8080/health
# Response: {"status":"ok"}

# Stop container
docker-compose down
```

## 🎯 API Reference

### Base Configuration

- **Container Name:** `whisper-swedish-turbo`
- **Base URL:** `http://localhost:8080`
- **Model:** `ggml-large-v3-turbo.bin` (1.6GB, ~2x real-time processing)
- **Language:** Swedish with speaker diarization
- **Audio Support:** WAV, M4A, MP3 (auto-converted)

### Endpoints

#### 1. Health Check

```http
GET /health
```

**Response:**

```json
{ "status": "ok" }
```

#### 2. Web Interface

```http
GET /
```

**Response:** HTML interface for testing

#### 3. Audio Transcription (Main API)

```http
POST /inference
Content-Type: multipart/form-data
```

**Request Parameters:** | Parameter | Type | Required | Description |
|-----------|------|----------|-------------| | `file` | File | Yes | Audio file (WAV, M4A, MP3) | |
`response_format` | String | No | "json" (default), "text" | | `temperature` | Float | No | 0.0-1.0,
controls randomness (default: 0.0) | | `language` | String | No | Override language (default: sv) |

**Success Response:**

```json
{
  "text": "(speaker ?) Här är vi kvaren.\n(speaker ?) Ja, här är vi kvaren tidigare.\n(speaker ?) Det går bra.\n(speaker ?) Nej men...\n(speaker ?) Allting vi gör borde vara...\n(speaker ?) projekt specifikt."
}
```

**Error Response:**

```json
{
  "error": "no 'file' field in the request"
}
```

## 📁 File Upload Integration

### cURL Examples

```bash
# Basic transcription
curl -X POST http://localhost:8080/inference \
  -F "file=@audio.wav" \
  -F "response_format=json"

# With temperature control
curl -X POST http://localhost:8080/inference \
  -F "file=@audio.wav" \
  -F "temperature=0.2" \
  -F "response_format=json"

# Test with M4A (auto-converted)
curl -X POST http://localhost:8080/inference \
  -F "file=@recording.m4a" \
  -F "response_format=json"
```

### Python Integration

```python
import requests
import json

def transcribe_audio(file_path, temperature=0.0):
    """Transcribe audio file using whisper.cpp API"""

    url = "http://localhost:8080/inference"

    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'temperature': str(temperature),
            'response_format': 'json'
        }

        response = requests.post(url, files=files, data=data)

    if response.status_code == 200:
        result = response.json()
        return result.get('text', '')
    else:
        error = response.json()
        raise Exception(f"API Error: {error.get('error', 'Unknown error')}")

# Usage
try:
    transcript = transcribe_audio("swedish_audio.wav")
    print(transcript)
except Exception as e:
    print(f"Error: {e}")
```

### JavaScript/Node.js Integration

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function transcribeAudio(filePath, temperature = 0.0) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('temperature', temperature.toString());
  form.append('response_format', 'json');

  try {
    const response = await axios.post('http://localhost:8080/inference', form, {
      headers: form.getHeaders(),
    });

    return response.data.text;
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(`API Error: ${error.response.data.error}`);
    }
    throw error;
  }
}

// Usage
transcribeAudio('swedish_audio.wav')
  .then(transcript => console.log(transcript))
  .catch(error => console.error('Error:', error.message));
```

## 🌊 Streaming Implementation

### HTTP Chunked Streaming (Recommended)

```python
#!/usr/bin/env python3
"""
Production-ready HTTP streaming for whisper.cpp
Processes large audio files in chunks for near-real-time results
"""

import os
import requests
import subprocess
import tempfile
from typing import Iterator, Dict

class WhisperStreamer:
    def __init__(self, api_url="http://localhost:8080/inference", chunk_duration=30):
        self.api_url = api_url
        self.chunk_duration = chunk_duration

    def health_check(self) -> bool:
        """Check if whisper server is available"""
        try:
            response = requests.get("http://localhost:8080/health", timeout=5)
            return response.json().get('status') == 'ok'
        except:
            return False

    def chunk_audio(self, input_file: str) -> Iterator[str]:
        """Split audio into chunks for streaming processing"""

        # Get duration
        cmd = ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
               '-of', 'csv=p=0', input_file]
        duration = float(subprocess.check_output(cmd).decode().strip())

        # Create chunks
        for start_time in range(0, int(duration), self.chunk_duration):
            chunk_file = f"/tmp/chunk_{start_time:04d}.wav"

            cmd = [
                'ffmpeg', '-i', input_file,
                '-ss', str(start_time),
                '-t', str(self.chunk_duration),
                '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
                '-y', chunk_file
            ]

            subprocess.run(cmd, capture_output=True, check=True)
            yield chunk_file

    def transcribe_chunk(self, chunk_file: str) -> Dict:
        """Transcribe single audio chunk"""
        with open(chunk_file, 'rb') as f:
            files = {'file': f}
            data = {'response_format': 'json', 'temperature': '0.0'}

            response = requests.post(self.api_url, files=files, data=data)
            response.raise_for_status()

            return response.json()

    def stream_transcribe(self, audio_file: str) -> Iterator[Dict]:
        """Stream transcription results as they become available"""

        if not self.health_check():
            raise Exception("Whisper server not available")

        chunk_index = 0
        for chunk_file in self.chunk_audio(audio_file):
            try:
                result = self.transcribe_chunk(chunk_file)

                yield {
                    'chunk_index': chunk_index,
                    'start_time': chunk_index * self.chunk_duration,
                    'end_time': (chunk_index + 1) * self.chunk_duration,
                    'text': result.get('text', '').strip(),
                    'processing_complete': True
                }

                chunk_index += 1

            except Exception as e:
                yield {
                    'chunk_index': chunk_index,
                    'error': str(e),
                    'processing_complete': False
                }
            finally:
                os.unlink(chunk_file)

# Usage Example
if __name__ == "__main__":
    streamer = WhisperStreamer(chunk_duration=30)

    for result in streamer.stream_transcribe("long_swedish_audio.wav"):
        if result.get('error'):
            print(f"Error in chunk {result['chunk_index']}: {result['error']}")
        else:
            print(f"Chunk {result['chunk_index']} ({result['start_time']}s-{result['end_time']}s):")
            print(f"  {result['text']}")
            print()
```

### Real-time Integration Pattern

```python
import asyncio
import aiohttp
from pathlib import Path

class AsyncWhisperClient:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def transcribe(self, audio_path: Path, **kwargs) -> dict:
        """Async transcription for concurrent processing"""

        data = aiohttp.FormData()
        data.add_field('file', open(audio_path, 'rb'), filename=audio_path.name)
        data.add_field('response_format', 'json')

        for key, value in kwargs.items():
            data.add_field(key, str(value))

        async with self.session.post(f"{self.base_url}/inference", data=data) as response:
            if response.status == 200:
                return await response.json()
            else:
                error_data = await response.json()
                raise Exception(f"API Error: {error_data.get('error')}")

# Usage for concurrent processing
async def process_multiple_files(audio_files):
    async with AsyncWhisperClient() as client:
        tasks = [client.transcribe(Path(file)) for file in audio_files]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Error processing {audio_files[i]}: {result}")
            else:
                print(f"File {audio_files[i]}: {result['text'][:100]}...")

# Run with: asyncio.run(process_multiple_files(['file1.wav', 'file2.wav']))
```

## 📊 Performance & Limitations

### Performance Characteristics

| Metric              | Value                               |
| ------------------- | ----------------------------------- |
| Model               | ggml-large-v3-turbo.bin (1.6GB)     |
| Processing Speed    | ~2x real-time                       |
| Memory Usage        | ~2GB RAM                            |
| Concurrent Requests | 3-5 recommended                     |
| Max File Size       | ~100MB (limited by processing time) |
| Supported Formats   | WAV, M4A, MP3 (auto-converted)      |

### Response Times (Typical)

| Audio Length | Processing Time | Real-time Factor |
| ------------ | --------------- | ---------------- |
| 30 seconds   | ~15 seconds     | 2.0x             |
| 1 minute     | ~30 seconds     | 2.0x             |
| 5 minutes    | ~150 seconds    | 2.0x             |
| 10 minutes   | ~300 seconds    | 2.0x             |

### Best Practices

1. **File Size:** Keep individual files under 10 minutes for optimal response times
2. **Concurrent Requests:** Limit to 3-5 simultaneous requests to prevent memory issues
3. **Audio Format:** Use 16kHz WAV files for fastest processing (no conversion needed)
4. **Chunking:** For files >5 minutes, use HTTP chunking approach for better UX
5. **Error Handling:** Always implement retry logic for network timeouts
6. **Health Monitoring:** Check `/health` endpoint before processing

## 🔧 Integration Examples

### Web Application Integration

```javascript
// Frontend JavaScript for file upload
async function uploadAudio(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('response_format', 'json');

  try {
    const response = await fetch('http://localhost:8080/inference', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Unknown error');
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

// Usage with file input
document.getElementById('audioFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    document.getElementById('status').textContent = 'Processing...';
    const transcript = await uploadAudio(file);
    document.getElementById('result').textContent = transcript;
    document.getElementById('status').textContent = 'Complete';
  } catch (error) {
    document.getElementById('status').textContent = `Error: ${error.message}`;
  }
});
```

### Microservice Integration

```python
from flask import Flask, request, jsonify
import requests
import tempfile
import os

app = Flask(__name__)
WHISPER_URL = "http://localhost:8080/inference"

@app.route('/transcribe', methods=['POST'])
def transcribe_endpoint():
    """Proxy endpoint for whisper.cpp integration"""

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)

            # Forward to whisper.cpp
            with open(tmp_file.name, 'rb') as f:
                files = {'file': f}
                data = {'response_format': 'json'}

                response = requests.post(WHISPER_URL, files=files, data=data)

            # Cleanup
            os.unlink(tmp_file.name)

            if response.status_code == 200:
                result = response.json()
                return jsonify({
                    'success': True,
                    'transcript': result['text'],
                    'processing_time': response.elapsed.total_seconds()
                })
            else:
                error = response.json()
                return jsonify({
                    'success': False,
                    'error': error.get('error', 'Unknown error')
                }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### Background Job Processing

```python
import celery
import requests
from celery import Celery

app = Celery('whisper_tasks', broker='redis://localhost:6379')

@app.task(bind=True, max_retries=3)
def transcribe_audio_task(self, file_path, callback_url=None):
    """Background task for audio transcription"""

    try:
        # Health check
        health_response = requests.get("http://localhost:8080/health", timeout=5)
        if health_response.json().get('status') != 'ok':
            raise Exception("Whisper server not available")

        # Process file
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'response_format': 'json', 'temperature': '0.0'}

            response = requests.post(
                "http://localhost:8080/inference",
                files=files,
                data=data,
                timeout=600  # 10 minute timeout
            )

        if response.status_code == 200:
            result = response.json()

            # Optional callback
            if callback_url:
                requests.post(callback_url, json={
                    'task_id': self.request.id,
                    'status': 'completed',
                    'transcript': result['text']
                })

            return {
                'status': 'completed',
                'transcript': result['text'],
                'file_path': file_path
            }
        else:
            error = response.json()
            raise Exception(f"API Error: {error.get('error')}")

    except Exception as e:
        # Retry logic
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60, exc=e)

        # Final failure
        if callback_url:
            requests.post(callback_url, json={
                'task_id': self.request.id,
                'status': 'failed',
                'error': str(e)
            })

        return {
            'status': 'failed',
            'error': str(e),
            'file_path': file_path
        }

# Usage
# task = transcribe_audio_task.delay('/path/to/audio.wav', 'http://myapp.com/callback')
```

## 🚨 Error Handling & Troubleshooting

### Common Errors

#### 1. Container Not Running

```bash
# Check container status
docker ps | grep whisper

# If not running, start it
docker-compose up -d

# Check logs for startup issues
docker logs whisper-swedish-turbo
```

#### 2. File Format Issues

```json
// Error response for unsupported format
{
  "error": "failed to read audio data"
}

// Solution: Ensure --convert flag is used in container
// Or pre-convert files to 16kHz WAV
```

#### 3. Memory Issues

```bash
# If container crashes with large files
docker logs whisper-swedish-turbo

# Common cause: Multiple large concurrent requests
# Solution: Implement request queuing or file size limits
```

#### 4. Network Timeouts

```python
# Always set appropriate timeouts
import requests

response = requests.post(
    "http://localhost:8080/inference",
    files=files,
    data=data,
    timeout=300  # 5 minutes for large files
)
```
