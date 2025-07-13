'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Square, Pause, Play, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    checkRecordingSupport();
  }, []);

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
      
      const deviceDebug = `Found ${audioInputs.length} audio input device(s): ${audioInputs.map(d => d.label || 'Unknown device').join(', ')}`;
      setDeviceInfo(deviceDebug);
      console.log(deviceDebug);
      
      if (audioInputs.length === 0) {
        console.log('No audio input devices found');
        setRecordingSupported(false);
        return;
      }
      
      // Test with minimal constraints first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
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

      // Try with optimal settings first, fallback to basic if needed
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        });
      } catch (error) {
        console.log('Optimal settings failed, trying basic constraints:', error);
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
      }

      // Use audio/webm for better mobile compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: mimeType });
          await uploadRecording(audioBlob);
        }
        
        setAudioChunks([]);
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      recorder.start(1000); // Collect data every second
      toast.success('Recording started');

    } catch (error) {
      console.error('Error starting recording:', error);
      
      let errorMessage = 'Failed to start recording. ';
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          errorMessage += 'No microphone found.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage += 'Microphone permission denied.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Microphone is already in use.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage += 'Microphone constraints not supported.';
        } else {
          errorMessage += 'Please check microphone permissions and device.';
        }
      } else {
        errorMessage += 'Please check microphone permissions and device.';
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
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      toast.success('Recording stopped');
    }
  }

  async function uploadRecording(audioBlob: Blob) {
    setIsUploading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording-${timestamp}.webm`;
      
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      toast.success('Recording uploaded successfully!');
      
      // Redirect to files page to see the uploaded recording
      setTimeout(() => {
        window.location.href = '/files';
      }, 1500);
    } catch (error) {
      toast.error('Failed to upload recording');
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
                      </div>
                    )}
                  </div>

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
                      <li>• Supports: iPhone Safari, Chrome, Firefox, Edge</li>
                      <li>• For best quality, record in a quiet environment</li>
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