'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Square, Pause, Play, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClientOnly } from '@/components/client-only';

// Wake Lock API types (if not already defined)
interface WakeLockSentinel {
  release: () => void;
}

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [speakerCount, setSpeakerCount] = useState<number>(2);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [autoSaveCounter, setAutoSaveCounter] = useState(0);

  useEffect(() => {
    checkRecordingSupport();
    detectMobile();
  }, []);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, [wakeLock]);

  // Handle page visibility changes (mobile tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording && isMobile) {
        console.log('Page became hidden during recording');
        toast.warning('Recording may be interrupted in background');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, isMobile]);

  // Timer effect for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Auto-save effect - every 10 minutes (600 seconds)
  useEffect(() => {
    let autoSaveInterval: NodeJS.Timeout;
    if (isRecording && !isPaused && mediaRecorder) {
      autoSaveInterval = setInterval(() => {
        performAutoSave();
      }, 10 * 60 * 1000); // 10 minutes
    }
    return () => clearInterval(autoSaveInterval);
  }, [isRecording, isPaused, mediaRecorder]);

  function detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    setIsMobile(isMobileDevice);
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && isMobile) {
        const wakeLockInstance = await (navigator as any).wakeLock.request('screen');
        setWakeLock(wakeLockInstance);
        console.log('Wake lock acquired');
      }
    } catch (error) {
      console.log('Wake lock not supported or failed:', error);
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      setWakeLock(null);
      console.log('Wake lock released');
    }
  }

  async function checkRecordingSupport() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('MediaDevices API not available');
        setRecordingSupported(false);
        return;
      }
      
      // Check if audio devices are available first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      const deviceDebug = `${isMobile ? '📱 Mobile' : '💻 Desktop'} - Found ${audioInputs.length} audio input device(s): ${audioInputs.map(d => d.label || 'Unknown device').join(', ')}`;
      setDeviceInfo(deviceDebug);
      console.log(deviceDebug);
      
      if (audioInputs.length === 0) {
        console.log('No audio input devices found');
        setRecordingSupported(false);
        return;
      }
      
      // Test with mobile-optimized constraints
      const mobileConstraints = {
        audio: isMobile ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Lower sample rate for mobile
          channelCount: 1     // Mono for mobile
        } : { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
      
      // Clean up test stream
      stream.getTracks().forEach(track => track.stop());
      setRecordingSupported(true);
      
    } catch (error) {
      console.error('Recording not supported:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          console.log('No microphone device found');
        } else if (error.name === 'NotAllowedError') {
          console.log('Microphone permission denied');
        } else if (error.name === 'NotReadableError') {
          console.log('Microphone is already in use');
        }
      }
      setRecordingSupported(false);
    }
  }

  async function startRecording() {
    try {
      if (!recordingSupported) {
        toast.error('Recording not supported on this device');
        return;
      }

      // Use mobile-optimized settings
      let stream;
      try {
        if (isMobile) {
          // Mobile-optimized constraints
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000,
              channelCount: 1
            }
          });
        } else {
          // Desktop optimal settings
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100
            }
          });
        }
      } catch (error) {
        console.log('Optimized settings failed, trying basic constraints:', error);
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
      }

      // Choose best MIME type for mobile compatibility
      let mimeType;
      if (isMobile) {
        // Mobile-optimized MIME types (iOS Safari prefers mp4)
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else {
          mimeType = 'audio/wav';
        }
      } else {
        // Desktop optimal MIME types
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = 'audio/webm';
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: isMobile ? 64000 : 128000 // Lower bitrate for mobile
      });

      // Request wake lock for mobile to prevent screen sleep
      if (isMobile) {
        await requestWakeLock();
      }

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('Audio data chunk received:', event.data.size, 'bytes');
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        console.log('Recording stopped, chunks collected:', chunks.length);
        console.log('Total chunks size:', chunks.reduce((total, chunk) => total + chunk.size, 0), 'bytes');
        
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: mimeType });
          console.log('Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
          await uploadRecording(audioBlob);
        } else {
          console.error('No audio chunks collected');
          toast.error('No audio data recorded. Please try again.');
        }
        
        setAudioChunks([]);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred');
        setIsRecording(false);
        setIsPaused(false);
        if (isMobile) {
          releaseWakeLock();
        }
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start recording with a small delay for mobile compatibility
      setTimeout(() => {
        if (recorder.state === 'inactive') {
          recorder.start(1000); // Collect data every second
          console.log('MediaRecorder started, MIME type:', mimeType);
          toast.success('Recording started');
        }
      }, 100);

    } catch (error) {
      console.error('Error starting recording:', error);
      
      let errorMessage = 'Failed to start recording. ';
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          errorMessage += isMobile ? 'No microphone found. Try using headphones with mic.' : 'No microphone found.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage += isMobile ? 'Microphone permission denied. Check browser settings and try again.' : 'Microphone permission denied.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += isMobile ? 'Microphone is already in use. Close other apps and try again.' : 'Microphone is already in use.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage += isMobile ? 'Microphone settings not supported. Try a different browser.' : 'Microphone constraints not supported.';
        } else {
          errorMessage += isMobile ? 'Please check microphone permissions in browser settings.' : 'Please check microphone permissions and device.';
        }
      } else {
        errorMessage += isMobile ? 'Please check microphone permissions in browser settings.' : 'Please check microphone permissions and device.';
      }
      
      toast.error(errorMessage);
    }
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      toast.success('Recording paused');
    }
  }

  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      toast.success('Recording resumed');
    }
  }

  function stopRecording() {
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      console.log('Stopping recording, current state:', mediaRecorder.state);
      
      // Request final data before stopping
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }
      
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Reset auto-save state
      setLastAutoSave(null);
      setAutoSaveCounter(0);
      
      // Release wake lock when recording stops
      if (isMobile) {
        releaseWakeLock();
      }
      
      toast.success('Recording stopped');
    }
  }

  async function performAutoSave() {
    if (!mediaRecorder || !audioChunks.length) return;
    
    try {
      console.log('Performing auto-save...');
      
      // Request current data from MediaRecorder
      mediaRecorder.requestData();
      
      // Wait a bit for the data to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (audioChunks.length > 0) {
        // Create blob from current chunks
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const autoSaveBlob = new Blob([...audioChunks], { type: mimeType });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const autoSaveCount = autoSaveCounter + 1;
        
        // Choose appropriate file extension
        let extension = '.webm';
        if (mimeType.includes('mp4')) {
          extension = '.mp4';
        } else if (mimeType.includes('wav')) {
          extension = '.wav';
        }
        
        const filename = `recording-autosave-${timestamp}-part${autoSaveCount}${extension}`;
        
        const formData = new FormData();
        formData.append('audio', autoSaveBlob, filename);
        formData.append('speakerCount', speakerCount.toString());
        formData.append('isDraft', 'true'); // Mark as draft to skip transcription
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          setLastAutoSave(new Date());
          setAutoSaveCounter(autoSaveCount);
          toast.success(`Auto-saved recording (part ${autoSaveCount})`, {
            duration: 2000,
          });
          console.log('Auto-save successful:', filename);
        } else {
          console.error('Auto-save failed:', response.status);
          toast.error('Auto-save failed', { duration: 2000 });
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      toast.error('Auto-save failed', { duration: 2000 });
    }
  }

  async function uploadRecording(audioBlob: Blob, isDraft: boolean = false) {
    setIsUploading(true);
    try {
      console.log('Starting upload:', {
        size: audioBlob.size,
        type: audioBlob.type,
        lastModified: new Date().toISOString(),
        isDraft
      });

      // Check if blob is empty
      if (audioBlob.size === 0) {
        throw new Error('Recording is empty - no audio data captured');
      }

      // Check if blob is too small (less than 1KB might indicate an issue)
      if (audioBlob.size < 1024) {
        console.warn('Warning: Recording is very small:', audioBlob.size, 'bytes');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Choose appropriate file extension based on MIME type
      let extension = '.webm';
      if (audioBlob.type.includes('mp4')) {
        extension = '.mp4';
      } else if (audioBlob.type.includes('wav')) {
        extension = '.wav';
      } else if (audioBlob.type.includes('webm')) {
        extension = '.webm';
      }
      
      const filename = isDraft 
        ? `recording-draft-${timestamp}${extension}`
        : `recording-${timestamp}${extension}`;
      console.log('Upload filename:', filename);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      formData.append('speakerCount', speakerCount.toString());
      if (isDraft) {
        formData.append('isDraft', 'true');
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Upload failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      toast.success(isDraft ? 'Draft recording saved!' : 'Recording uploaded successfully!');
      
      // Only redirect for final recordings, not drafts
      if (!isDraft) {
        setTimeout(() => {
          window.location.href = '/files';
        }, 1500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to upload recording: ${errorMessage}`);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }

  function formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Record Audio</h1>
        <p className="text-muted-foreground mt-1">Record and transcribe audio directly from your device</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl">
                <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                Audio Recording
              </CardTitle>
              <CardDescription>
                {recordingSupported 
                  ? "Record audio directly from your device" 
                  : "Recording not supported on this device"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {recordingSupported ? (
                <>
                  {/* Speaker Count Selection */}
                  {!isRecording && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <label htmlFor="speakerCount" className="text-sm font-medium">
                        Expected speakers:
                      </label>
                      <Select value={speakerCount.toString()} onValueChange={(value) => setSpeakerCount(parseInt(value))}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="9">9</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Recording Status */}
                  <div className="text-center">
                    <div className="text-4xl sm:text-6xl font-mono font-bold mb-2">
                      {formatRecordingTime(recordingTime)}
                    </div>
                    {isRecording && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                        )} />
                        {isPaused ? "Paused" : "Recording"}
                        {isMobile && wakeLock && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            🔒 Screen locked
                          </span>
                        )}
                      </div>
                    )}
                    {isRecording && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Expecting {speakerCount} speaker{speakerCount > 1 ? 's' : ''}
                        {lastAutoSave && (
                          <ClientOnly>
                            <div className="text-xs text-green-600 mt-1">
                              ✓ Auto-saved: {lastAutoSave.toLocaleTimeString()}
                            </div>
                          </ClientOnly>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile warning */}
                  {isMobile && isRecording && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <div className="text-sm text-amber-700 font-medium">
                        📱 Keep this tab active during recording
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        Background recording may be interrupted on mobile devices
                      </div>
                    </div>
                  )}

                  {/* Recording Controls */}
                  <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                        size="lg"
                        disabled={isUploading}
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </Button>
                    ) : (
                      <>
                        {!isPaused ? (
                          <Button
                            onClick={pauseRecording}
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto"
                          >
                            <Pause className="h-5 w-5 mr-2" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            onClick={resumeRecording}
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto"
                          >
                            <Play className="h-5 w-5 mr-2" />
                            Resume
                          </Button>
                        )}
                        <Button
                          onClick={stopRecording}
                          variant="destructive"
                          size="lg"
                          className="w-full sm:w-auto"
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <Square className="h-5 w-5 mr-2" />
                          )}
                          {isUploading ? 'Uploading...' : 'Stop & Save'}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Recording Tips */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Recording Tips
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Allow microphone permissions when prompted</li>
                      <li>• Use HTTPS for best compatibility (especially iOS)</li>
                      <li>• Keep the browser tab active during recording</li>
                      <li>• Recording automatically uploads when stopped</li>
                      <li>• Auto-saves every 10 minutes to prevent data loss</li>
                      <li>• Supports: iPhone Safari, Chrome, Firefox, Edge</li>
                      <li>• For best quality, record in a quiet environment</li>
                      {isMobile && (
                        <>
                          <li>• 📱 Mobile optimized: Lower bitrate for faster upload</li>
                          <li>• 🔒 Screen will stay awake during recording</li>
                          <li>• 🎤 Use device orientation for best microphone position</li>
                        </>
                      )}
                    </ul>
                    {deviceInfo && (
                      <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                        <div className="text-xs text-muted-foreground">
                          🔍 Debug: {deviceInfo}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-muted-foreground mb-4">
                    Recording is not supported on this device or browser.
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    Try using HTTPS or a modern browser like Chrome, Safari, or Firefox.
                  </div>
                  {deviceInfo && (
                    <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
                      🔍 Debug: {deviceInfo}
                    </div>
                  )}
                  <div className="mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = '/files'}
                    >
                      Upload Files Instead
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/files'}>
              <CardContent className="p-4 text-center">
                <div className="text-lg font-medium">Upload Files</div>
                <div className="text-sm text-muted-foreground">Choose audio files from your device</div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/transcripts'}>
              <CardContent className="p-4 text-center">
                <div className="text-lg font-medium">View Transcripts</div>
                <div className="text-sm text-muted-foreground">See your completed transcriptions</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}