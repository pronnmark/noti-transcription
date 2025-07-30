'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mic, Square, Pause, Play, Loader2, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClientOnly } from '@/components/client-only';
import { locationService } from '@/lib/services/locationService';
import type { LocationData } from '@/lib/services/locationService';
import { AudioLevelMeter } from '@/components/ui/audio-level-meter';
import { WorkflowStatus } from '@/components/ui/workflow-status';
import { TranscriptViewer } from '@/components/ui/transcript-viewer';
import { useRecordingStore } from '@/stores/recordingStore';

// Wake Lock API types (if not already defined)
interface WakeLockSentinel {
  release: () => void;
}

// Extend Window interface for custom properties
declare global {
  interface Window {
    lastAudioLevelLog?: number;
  }
}

export default function RecordPage() {
  // Zustand store
  const {
    // Recording states
    isRecording,
    isPaused,
    recordingTime,
    mediaRecorder,
    audioChunks,
    recordingSupported,
    deviceInfo,
    supportError,
    isMobile,
    wakeLock,
    speakerCount,
    lastAutoSave,
    autoSaveCounter,

    // Audio level monitoring
    audioLevel,
    audioAnalyser,
    levelAnimationFrame,

    // Location tracking
    locationData,
    isLocationTracking,

    // Workflow states
    workflowPhase,
    uploadProgress,
    transcriptionProgress,
    fileId,
    transcript,
    error: workflowError,

    // Actions
    setRecordingState,
    setRecordingTime,
    setMediaRecorder,
    setAudioChunks,
    setAudioLevel,
    setAudioAnalyser,
    setLevelAnimationFrame,
    setRecordingSupport,
    setIsMobile,
    setWakeLock,
    setSpeakerCount,
    setAutoSaveData,
    setLocationData,
    setLocationTracking,
    setWorkflowPhase,
    setUploadProgress,
    setFileId,
    setError,
    resetWorkflow,
    startTranscriptionPolling,
    stopTranscriptionPolling,
  } = useRecordingStore();

  // Local state for upload status
  const [isUploading, setIsUploading] = useState(false);

  // Location error state (local since it's just for logging)
  const [_locationError, setLocationError] = useState<string | null>(null);

  // Supabase connection status
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  // Ref to store the cloned audio stream for the analyser
  const analyserStreamRef = useRef<MediaStream | null>(null);

  // Ref to store the animation frame ID
  const animationFrameRef = useRef<number | null>(null);

  // Ref to store the last known location to ensure it persists through upload
  const lastLocationRef = useRef<LocationData | null>(null);

  // Check Supabase connection status
  const checkSupabaseConnection = useCallback(async () => {
    try {
      console.log('🔍 Checking Supabase connection via API...');
      const response = await fetch('/api/health');
      const healthData = await response.json();
      
      const isConnected = healthData.database?.healthy === true;
      setSupabaseConnected(isConnected);
      
      if (isConnected) {
        console.log('✅ Supabase connection healthy via API');
      } else {
        console.warn('⚠️ Supabase connection issue detected:', healthData);
      }
    } catch (error) {
      console.error('Failed to check Supabase connection via API:', error);
      setSupabaseConnected(false);
    }
  }, []);

  const checkRecordingSupport = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('MediaDevices API not available');
        setRecordingSupport(
          false,
          'Your browser does not support audio recording. Please use Chrome, Firefox, or Safari with HTTPS.'
        );
        return;
      }

      // Check if MediaRecorder is supported
      if (typeof MediaRecorder === 'undefined') {
        setRecordingSupport(
          false,
          'MediaRecorder API not supported. Please update your browser.'
        );
        return;
      }

      // Check if audio devices are available (no permission request)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        device => device.kind === 'audioinput'
      );

      const deviceDebug = `${isMobile ? '📱 Mobile' : '💻 Desktop'} - Found ${audioInputs.length} audio input device(s)`;
      console.log(deviceDebug);

      if (audioInputs.length === 0) {
        console.log('No audio input devices found');
        setRecordingSupport(
          false,
          'No microphone detected. Please connect a microphone and refresh the page.',
          deviceDebug
        );
        return;
      }

      // Don't test actual stream access here to avoid permission issues
      // Permission will be requested when user clicks record
      setRecordingSupport(true, '', deviceDebug);
    } catch (error) {
      console.error('Recording support check failed:', error);
      setRecordingSupport(
        false,
        'Unable to check recording capabilities. Please check your browser permissions.'
      );
    }
  }, []); // Remove isMobile dependency to prevent infinite loops

  const performAutoSave = useCallback(async () => {
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

        // Include location data if available
        if (locationData) {
          formData.append('latitude', locationData.latitude.toString());
          formData.append('longitude', locationData.longitude.toString());
          formData.append('locationAccuracy', locationData.accuracy.toString());
          formData.append(
            'locationTimestamp',
            locationData.timestamp.toString()
          );
          formData.append('locationProvider', locationData.provider);
        }

        console.log('📤 Sending auto-save upload request...');
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type - let browser set it automatically for FormData
        });

        if (response.ok) {
          setAutoSaveData(new Date(), autoSaveCount);
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
  }, [mediaRecorder, audioChunks, autoSaveCounter, speakerCount, locationData]);

  useEffect(() => {
    detectMobile(); // Run first to set isMobile
    checkRecordingSupport(); // Then check recording support
    checkSupabaseConnection(); // Check Supabase connection
  }, []); // Run once on mount only

  // Clean up wake lock and audio monitoring on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
      // Clean up location tracking on unmount
      if (isLocationTracking && locationService.isCurrentlyTracking()) {
        locationService.stopTracking();
        setLocationTracking(false);
      }
      // Clean up audio level monitoring
      if (levelAnimationFrame) {
        cancelAnimationFrame(levelAnimationFrame);
      }
      if (audioAnalyser) {
        audioAnalyser.disconnect();
      }
    };
  }, [wakeLock, isLocationTracking, levelAnimationFrame, audioAnalyser]);

  // Handle page visibility changes (mobile tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording && isMobile) {
        console.log('Page became hidden during recording');
        toast.warning('Recording may be interrupted in background');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, isMobile]);

  // Timer effect for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(recordingTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused, recordingTime, setRecordingTime]);

  // Auto-save effect - every 10 minutes (600 seconds)
  useEffect(() => {
    let autoSaveInterval: NodeJS.Timeout;
    if (isRecording && !isPaused && mediaRecorder) {
      autoSaveInterval = setInterval(
        () => {
          performAutoSave();
        },
        10 * 60 * 1000
      ); // 10 minutes
    }
    return () => clearInterval(autoSaveInterval);
  }, [isRecording, isPaused, mediaRecorder, performAutoSave]);

  function detectMobile() {
    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    setIsMobile(isMobileDevice);
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && isMobile) {
        const wakeLockInstance = await (navigator as any).wakeLock.request(
          'screen'
        );
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

  async function startLocationTracking() {
    if (!locationService.isSupported()) {
      console.log(
        'Geolocation not supported - recording will continue without location data'
      );
      return;
    }

    try {
      console.log('🗺️ Starting location tracking for recording session...');

      await locationService.startTracking(
        (location: LocationData) => {
          setLocationData(location);
          lastLocationRef.current = location; // Store in ref to ensure persistence
          setLocationError(null);
          console.log('📍 Location updated during recording:', location);
        },
        (error: string) => {
          setLocationError(error);
          console.warn('⚠️ Location error during recording:', error);
          // Don't show toast - recording should continue without location
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
          updateInterval: 30000, // Update every 30 seconds during recording
        }
      );

      setLocationTracking(true);
      console.log('✅ Location tracking active');
    } catch (error) {
      console.warn('⚠️ Failed to start location tracking:', error);
      setLocationError(
        error instanceof Error ? error.message : 'Location tracking failed'
      );
      // Recording continues without location
    }
  }

  function stopLocationTracking() {
    if (isLocationTracking && locationService.isCurrentlyTracking()) {
      locationService.stopTracking();
      setLocationTracking(false);
      console.log('🛑 Location tracking stopped');
    }
  }

  // Audio level monitoring functions
  async function startAudioLevelMonitoring(stream: MediaStream) {
    try {
      console.log('🎵 Starting audio level monitoring...');

      // Debug: Check stream tracks
      const audioTracks = stream.getAudioTracks();
      console.log(`🎵 Stream has ${audioTracks.length} audio tracks`);
      audioTracks.forEach((track, index) => {
        console.log(
          `🎵 Track ${index}: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`
        );
      });

      // Create Web Audio API context
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      // Note: Don't resume suspended context here - Chrome requires user gesture
      // It will be resumed in startRecording() with proper user interaction

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();

      // Configure analyser with better settings for voice
      analyser.fftSize = 2048; // Good frequency resolution
      analyser.smoothingTimeConstant = 0.2; // Less smoothing for more responsive readings
      analyser.minDecibels = -90; // Less sensitive to very quiet sounds
      analyser.maxDecibels = -30; // Better range for voice

      // Mute the gain node so we don't hear the audio
      gainNode.gain.value = 0;

      // Connect nodes in a complete audio graph
      // Source → Analyser → Gain (muted) → Destination
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);

      setAudioAnalyser(analyser);

      let isMonitoringActive = true;

      // Enhanced audio level monitoring with improved sensitivity
      const monitorAudioLevel = () => {
        try {
          // Check if we should continue monitoring
          if (!isMonitoringActive) {
            return;
          }

          // Try float data for better precision if available
          let rms = 0;
          let peak = 0;
          let minValue = 1;
          let maxValue = -1;
          const noiseFloor = 0.01;

          try {
            // Try getFloatTimeDomainData for better precision
            const floatData = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(floatData);

            // Calculate RMS and peak from float data
            let sum = 0;
            for (let i = 0; i < floatData.length; i++) {
              const sample = floatData[i];
              minValue = Math.min(minValue, sample);
              maxValue = Math.max(maxValue, sample);
              sum += sample * sample;
              peak = Math.max(peak, Math.abs(sample));
            }
            rms = Math.sqrt(sum / floatData.length);
          } catch (e) {
            // Fallback to byte data if float is not supported
            const timeData = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(timeData);

            // Calculate RMS and peak from byte data
            let sum = 0;
            minValue = 255;
            maxValue = 0;
            for (let i = 0; i < timeData.length; i++) {
              minValue = Math.min(minValue, timeData[i]);
              maxValue = Math.max(maxValue, timeData[i]);
              const sample = (timeData[i] - 128) / 128;
              const absSample = Math.abs(sample);
              sum += sample * sample;
              peak = Math.max(peak, absSample);
            }
            rms = Math.sqrt(sum / timeData.length);
          }

          // Enhanced level calculation with logarithmic scaling and noise floor
          let level = 0;
          if (rms > noiseFloor) {
            // Use logarithmic scaling for better visual representation
            const logLevel = Math.log10(rms / noiseFloor + 1) * 50; // Logarithmic scaling
            const linearLevel = rms * 100 * 15; // 15x multiplier for speech sensitivity

            // Combine logarithmic and linear scaling for optimal response
            level = Math.max(logLevel, linearLevel);

            // Use peak detection as fallback for very quiet audio
            if (level < 5 && peak > noiseFloor) {
              level = Math.max(level, peak * 100 * 8); // Peak-based fallback
            }
          }

          // Clamp to 0-100 range with smooth ceiling
          level = Math.min(100, Math.max(0, level));

          setAudioLevel(level);

          // Check and resume AudioContext if suspended (Chrome auto-suspends after ~30s)
          if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => {
              console.error('Failed to resume AudioContext:', err);
            });
          }

          // Continue monitoring
          const frameId = requestAnimationFrame(monitorAudioLevel);
          animationFrameRef.current = frameId; // Store in ref instead of state
        } catch (error) {
          console.error(`❌ Error in monitorAudioLevel:`, error);
          console.error('Stack trace:', (error as any).stack);
          // Try to recover by scheduling next frame anyway
          const frameId = requestAnimationFrame(monitorAudioLevel);
          animationFrameRef.current = frameId; // Store in ref instead of state
        }
      };

      // Store cleanup function to stop monitoring
      (window as any).stopAudioMonitoring = () => {
        isMonitoringActive = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };

      // Start the monitoring loop
      monitorAudioLevel();
    } catch (error) {
      console.error('Failed to start audio level monitoring:', error);
      // Recording continues without level monitoring
    }
  }

  function stopAudioLevelMonitoring() {
    // Call the cleanup function if it exists
    if ((window as any).stopAudioMonitoring) {
      (window as any).stopAudioMonitoring();
      delete (window as any).stopAudioMonitoring;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear the state too (though it's not used for the loop anymore)
    if (levelAnimationFrame) {
      setLevelAnimationFrame(null);
    }

    if (audioAnalyser) {
      audioAnalyser.disconnect();
      setAudioAnalyser(null);
    }

    // Clean up monitoring stream
    if (analyserStreamRef.current) {
      analyserStreamRef.current.getTracks().forEach(track => track.stop());
      analyserStreamRef.current = null;
      console.log('🔇 Stopped analyser stream tracks');
    }

    setAudioLevel(0);
  }

  async function startRecording() {
    console.log(
      '🎙️ startRecording called, recordingSupported:',
      recordingSupported
    );
    try {
      if (!recordingSupported) {
        console.error('❌ Recording not supported on this device');
        toast.error('Recording not supported on this device');
        return;
      }

      // Resume any suspended audio context with user gesture
      try {
        if (audioAnalyser && (audioAnalyser as any).context) {
          const ctx = (audioAnalyser as any).context;
          if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log('✅ Audio context resumed with user gesture');
          }
        }
      } catch (error) {
        console.warn('Could not resume audio context:', error);
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
              channelCount: 1,
            },
          });
        } else {
          // Desktop optimal settings
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
            },
          });
        }
      } catch (error) {
        console.log(
          'Optimized settings failed, trying basic constraints:',
          error
        );
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
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

      // Clone stream for audio monitoring to avoid conflicts with MediaRecorder
      const monitoringStream = stream.clone();
      analyserStreamRef.current = monitoringStream; // Store reference for cleanup
      console.log('🎙️ Using cloned stream for audio monitoring');

      // Start audio level monitoring with cloned stream
      // This prevents conflicts between analyser and MediaRecorder
      await startAudioLevelMonitoring(monitoringStream);

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: isMobile ? 64000 : 128000, // Lower bitrate for mobile
      });

      // Request wake lock for mobile to prevent screen sleep
      if (isMobile) {
        await requestWakeLock();
      }

      // Start location tracking (non-blocking - recording continues regardless)
      await startLocationTracking();

      const chunks: Blob[] = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('Audio data chunk received:', event.data.size, 'bytes');
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        // Clean up monitoring stream
        if (analyserStreamRef.current) {
          analyserStreamRef.current.getTracks().forEach(track => track.stop());
          analyserStreamRef.current = null;
          console.log('🔇 Stopped analyser stream tracks');
        }

        console.log('Recording stopped, chunks collected:', chunks.length);
        console.log(
          'Total chunks size:',
          chunks.reduce((total, chunk) => total + chunk.size, 0),
          'bytes'
        );

        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: mimeType });
          console.log(
            'Created audio blob:',
            audioBlob.size,
            'bytes, type:',
            audioBlob.type
          );
          await uploadRecording(audioBlob);
        } else {
          console.error('No audio chunks collected');
          toast.error('No audio data recorded. Please try again.');
        }

        setAudioChunks([]);
      };

      recorder.onerror = event => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred');
        setRecordingState(false, false);
        stopLocationTracking();
        stopAudioLevelMonitoring();
        if (isMobile) {
          releaseWakeLock();
        }
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      setRecordingState(true, false);
      setRecordingTime(0);
      console.log('✅ Recording state set: isRecording=true, isPaused=false');

      // Start recording immediately - no delay needed
      recorder.start(1000); // Collect data every second
      console.log('MediaRecorder started, MIME type:', mimeType);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);

      let errorMessage = 'Failed to start recording. ';
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          errorMessage += isMobile
            ? 'No microphone found. Try using headphones with mic.'
            : 'No microphone found.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage += isMobile
            ? 'Microphone permission denied. Check browser settings and try again.'
            : 'Microphone permission denied.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += isMobile
            ? 'Microphone is already in use. Close other apps and try again.'
            : 'Microphone is already in use.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage += isMobile
            ? 'Microphone settings not supported. Try a different browser.'
            : 'Microphone constraints not supported.';
        } else {
          errorMessage += isMobile
            ? 'Please check microphone permissions in browser settings.'
            : 'Please check microphone permissions and device.';
        }
      } else {
        errorMessage += isMobile
          ? 'Please check microphone permissions in browser settings.'
          : 'Please check microphone permissions and device.';
      }

      toast.error(errorMessage);
    }
  }

  function pauseRecording() {
    console.log('⏸️ pauseRecording called');
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setRecordingState(true, true);
      console.log('✅ Recording state set: isRecording=true, isPaused=true');
      toast.success('Recording paused');
    }
  }

  function resumeRecording() {
    console.log('▶️ resumeRecording called');
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setRecordingState(true, false);
      console.log('✅ Recording state set: isRecording=true, isPaused=false');
      toast.success('Recording resumed');
    }
  }

  function stopRecording() {
    if (
      mediaRecorder &&
      (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')
    ) {
      console.log('Stopping recording, current state:', mediaRecorder.state);

      // Request final data before stopping
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }

      mediaRecorder.stop();
      setRecordingState(false, false);
      setRecordingTime(0);

      // Reset auto-save state
      setAutoSaveData(null, 0);

      // Stop location tracking, audio monitoring, and release wake lock when recording stops
      stopLocationTracking();
      stopAudioLevelMonitoring();
      if (isMobile) {
        releaseWakeLock();
      }

      toast.success('Recording stopped');
    }
  }

  async function uploadRecording(audioBlob: Blob, isDraft: boolean = false) {
    setIsUploading(true);
    setWorkflowPhase('uploading');
    setUploadProgress(0);

    try {
      console.log('Starting upload:', {
        size: audioBlob.size,
        type: audioBlob.type,
        lastModified: new Date().toISOString(),
        isDraft,
      });

      // Check if blob is empty
      if (audioBlob.size === 0) {
        throw new Error('Recording is empty - no audio data captured');
      }

      // Check if blob is too small (less than 1KB might indicate an issue)
      if (audioBlob.size < 1024) {
        console.warn(
          'Warning: Recording is very small:',
          audioBlob.size,
          'bytes'
        );
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
      console.log('📤 Creating FormData with blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        filename,
      });

      formData.append('audio', audioBlob, filename);
      formData.append('speakerCount', speakerCount.toString());
      if (isDraft) {
        formData.append('isDraft', 'true');
      }

      // Debug FormData contents
      console.log('📤 FormData entries:');
      Array.from(formData.entries()).forEach(([key, value]) => {
        console.log(
          `  ${key}:`,
          value instanceof File
            ? `File(${value.name}, ${value.size} bytes)`
            : value
        );
      });

      // Include location data if available (check both store and ref)
      const locationToUpload = locationData || lastLocationRef.current;
      if (locationToUpload) {
        formData.append('latitude', locationToUpload.latitude.toString());
        formData.append('longitude', locationToUpload.longitude.toString());
        formData.append(
          'locationAccuracy',
          locationToUpload.accuracy.toString()
        );
        formData.append(
          'locationTimestamp',
          locationToUpload.timestamp.toString()
        );
        formData.append('locationProvider', locationToUpload.provider);
        console.log('📍 Including location data in upload:', locationToUpload);
      } else {
        console.log('📍 No location data available for upload');
      }

      // Detect device type
      const getDeviceType = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || 
                        (window.screen.width >= 768 && window.screen.width <= 1024);
        
        if (isTablet) return 'tablet';
        if (isMobile) return 'mobile';
        return 'desktop';
      };

      const deviceType = getDeviceType();
      formData.append('deviceType', deviceType);
      console.log('📱 Device type detected:', deviceType);

      console.log('📤 Sending upload request to:', window.location.origin + '/api/upload');
      console.log('📤 Current URL:', window.location.href);
      
      // Add more detailed error handling for network issues
      let response;
      try {
        response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type - let browser set it automatically for FormData
        });
        console.log('📤 Upload response status:', response.status);
      } catch (fetchError) {
        console.error('❌ Network error during upload:', fetchError);
        console.error('❌ Error details:', {
          name: fetchError.name,
          message: fetchError.message,
          cause: fetchError.cause
        });
        
        // Check if server is reachable
        try {
          console.log('🏥 Checking server health...');
          const healthCheck = await fetch('/api/health');
          console.log('🏥 Health check status:', healthCheck.status);
          if (healthCheck.ok) {
            throw new Error('Upload endpoint failed but server is reachable. Check server logs.');
          } else {
            throw new Error('Server is not responding properly. Please check if the development server is running.');
          }
        } catch (healthError) {
          console.error('❌ Health check failed:', healthError);
          throw new Error('Cannot connect to server. Please ensure the development server is running on the correct port.');
        }
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        
        // Handle error properly - errorData.error might be an object
        const errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : errorData.error?.message || JSON.stringify(errorData.error) || 'Unknown error';
        
        throw new Error(
          `Upload failed: ${response.status} - ${errorMessage}`
        );
      }

      const result = await response.json();
      console.log('Upload result:', result);

      setUploadProgress(100);

      if (isDraft) {
        toast.success('Draft recording saved!');
        setWorkflowPhase('idle'); // Return to idle for drafts
      } else {
        toast.success('Recording uploaded successfully!');

        // Extract fileId from the results array (check both response formats)
        const resultsArray = result.data?.results || result.results;
        const successfulFile = resultsArray?.find(
          (r: any) => r.success && r.fileId
        );
        const fileId = successfulFile?.fileId;

        if (fileId) {
          setFileId(fileId);
          setWorkflowPhase('transcribing');
          setUploadProgress(100);
          console.log(`✅ File uploaded successfully with ID: ${fileId}`);

          // Auto-trigger transcription worker
          try {
            const workerResponse = await fetch('/api/worker/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId }),
            });

            if (workerResponse.ok) {
              console.log('🚀 Transcription worker triggered successfully');
              // Start polling for transcription status
              startTranscriptionPolling(fileId);
            } else {
              throw new Error('Failed to start transcription');
            }
          } catch (transcriptionError) {
            console.error('Transcription trigger error:', transcriptionError);
            setError('Failed to start transcription');
            setWorkflowPhase('error');
          }
        } else {
          console.error('❌ Upload response missing fileId:', result);
          setError('Upload succeeded but no file ID returned');
          setWorkflowPhase('error');
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to upload recording: ${errorMessage}`);
      console.error('Upload error:', error);
      setError(errorMessage);
      setWorkflowPhase('error');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownloadRecording() {
    if (!fileId) {
      toast.error('No recording available to download');
      return;
    }

    try {
      toast.info('Preparing download...');
      
      // Verify download endpoint is accessible before opening
      const downloadUrl = `/api/files/${fileId}/download`;
      const response = await fetch(downloadUrl, { 
        method: 'HEAD',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Recording not found or no longer available');
        } else if (response.status === 500) {
          toast.error('Server error - unable to generate download link');
        } else {
          toast.error('Download failed - please try again');
        }
        return;
      }
      
      // Open download endpoint in new window/tab
      window.open(downloadUrl, '_blank');
      
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to initiate download');
      console.error('Download error:', error);
    }
  }

  function formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b p-4 sm:p-6'>
        <h1 className='text-2xl font-bold sm:text-3xl'>Record Audio</h1>
        <p className='mt-1 text-muted-foreground'>
          Record and transcribe audio directly from your device
        </p>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-auto p-4 sm:p-6'>
        <div className='mx-auto max-w-2xl space-y-6'>
          <Card>
            <CardHeader className='text-center'>
              <CardTitle className='flex items-center justify-center gap-2 text-lg sm:text-xl'>
                <Mic className='h-5 w-5 sm:h-6 sm:w-6' />
                Audio Recording
                {supabaseConnected === true && (
                  <div className='flex items-center gap-1 text-sm font-normal text-green-600'>
                    <CheckCircle className='h-4 w-4' />
                    <span className='hidden sm:inline'>Connected</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                {recordingSupported
                  ? 'Record audio directly from your device'
                  : 'Recording not supported on this device'}
              </CardDescription>
              {supabaseConnected === true && (
                <div className='mt-1 text-center text-xs text-green-600'>
                  ✓ Supabase database connected
                </div>
              )}
              {supabaseConnected === false && (
                <div className='mt-1 text-center text-xs text-amber-600'>
                  ⚠️ Database connection issue
                </div>
              )}
            </CardHeader>
            <CardContent className='space-y-6'>
              {recordingSupported ? (
                <>
                  {/* Speaker Count Selection */}
                  {!isRecording && (
                    <div className='mb-4 flex items-center justify-center gap-2'>
                      <label
                        htmlFor='speakerCount'
                        className='text-sm font-medium'
                      >
                        Expected speakers:
                      </label>
                      <Select
                        value={speakerCount.toString()}
                        onValueChange={value =>
                          setSpeakerCount(parseInt(value))
                        }
                      >
                        <SelectTrigger className='w-20'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='1'>1</SelectItem>
                          <SelectItem value='2'>2</SelectItem>
                          <SelectItem value='3'>3</SelectItem>
                          <SelectItem value='4'>4</SelectItem>
                          <SelectItem value='5'>5</SelectItem>
                          <SelectItem value='6'>6</SelectItem>
                          <SelectItem value='7'>7</SelectItem>
                          <SelectItem value='8'>8</SelectItem>
                          <SelectItem value='9'>9</SelectItem>
                          <SelectItem value='10'>10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Recording Status */}
                  <div className='text-center'>
                    <div className='mb-2 font-mono text-4xl font-bold sm:text-6xl'>
                      {formatRecordingTime(recordingTime)}
                    </div>
                    {isRecording && (
                      <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isPaused
                              ? 'bg-yellow-500'
                              : 'animate-pulse bg-red-500'
                          )}
                        />
                        {isPaused ? 'Paused' : 'Recording'}
                        {isMobile && wakeLock && (
                          <span className='rounded bg-green-100 px-2 py-1 text-xs text-green-800'>
                            🔒 Screen locked
                          </span>
                        )}
                      </div>
                    )}

                    {/* Audio Level Meter */}
                    {isRecording && (
                      <div className='mt-4'>
                        <AudioLevelMeter
                          audioLevel={isPaused ? 0 : audioLevel}
                          isActive={isRecording}
                          className='mx-auto max-w-sm'
                        />
                        {isPaused && (
                          <div className='mt-1 text-center text-xs text-muted-foreground'>
                            Audio monitoring paused
                          </div>
                        )}
                      </div>
                    )}
                    {isRecording && (
                      <div className='mt-1 text-xs text-muted-foreground'>
                        Expecting {speakerCount} speaker
                        {speakerCount > 1 ? 's' : ''}
                        {lastAutoSave && (
                          <ClientOnly>
                            <div className='mt-1 text-xs text-green-600'>
                              ✓ Auto-saved: {lastAutoSave.toLocaleTimeString()}
                            </div>
                          </ClientOnly>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile warning */}
                  {isMobile && isRecording && (
                    <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center'>
                      <div className='text-sm font-medium text-amber-700'>
                        📱 Keep this tab active during recording
                      </div>
                      <div className='mt-1 text-xs text-amber-600'>
                        Background recording may be interrupted on mobile
                        devices
                      </div>
                    </div>
                  )}

                  {/* Recording Controls */}
                  <div className='flex flex-col justify-center gap-3 sm:flex-row sm:gap-4'>
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        className='w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto'
                        size='lg'
                        disabled={isUploading}
                      >
                        <Mic className='mr-2 h-5 w-5' />
                        Start Recording
                      </Button>
                    ) : (
                      <>
                        {!isPaused ? (
                          <Button
                            onClick={pauseRecording}
                            variant='outline'
                            size='lg'
                            className='w-full sm:w-auto'
                          >
                            <Pause className='mr-2 h-5 w-5' />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            onClick={resumeRecording}
                            variant='outline'
                            size='lg'
                            className='w-full sm:w-auto'
                          >
                            <Play className='mr-2 h-5 w-5' />
                            Resume
                          </Button>
                        )}
                        <Button
                          onClick={stopRecording}
                          variant='destructive'
                          size='lg'
                          className='w-full sm:w-auto'
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                          ) : (
                            <Square className='mr-2 h-5 w-5' />
                          )}
                          {isUploading ? 'Uploading...' : 'Stop & Save'}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className='py-8 text-center'>
                  <AlertCircle className='mx-auto mb-4 h-12 w-12 text-red-500' />
                  <div className='mb-4 text-lg font-semibold text-red-600'>
                    Recording Not Available
                  </div>
                  {supportError && (
                    <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
                      <div className='text-sm text-red-700'>{supportError}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Status */}
          {(workflowPhase === 'uploading' ||
            workflowPhase === 'transcribing' ||
            workflowPhase === 'completed' ||
            workflowPhase === 'error') && (
            <WorkflowStatus
              phase={workflowPhase}
              uploadProgress={uploadProgress}
              transcriptionProgress={transcriptionProgress}
              error={workflowError}
              className='mt-6'
            />
          )}

          {/* Download Button */}
          {workflowPhase === 'completed' && fileId && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <CheckCircle className='h-5 w-5 text-green-600' />
                  Recording Complete
                </CardTitle>
                <CardDescription>
                  Your recording has been successfully uploaded and transcribed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col gap-3 sm:flex-row'>
                  <Button
                    onClick={handleDownloadRecording}
                    variant='outline'
                    className='flex items-center gap-2'
                  >
                    <Download className='h-4 w-4' />
                    Download Recording
                  </Button>
                  <Button
                    onClick={() => {
                      resetWorkflow();
                      toast.info('Ready for new recording!');
                    }}
                    variant='default'
                  >
                    Record Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcript Viewer */}
          {workflowPhase === 'completed' && transcript && (
            <TranscriptViewer
              transcript={transcript}
              fileName={`Recording-${new Date().toLocaleDateString()}`}
              speakerCount={speakerCount}
              fileId={fileId}
              onStartNewRecording={() => {
                resetWorkflow();
                toast.info('Ready for new recording!');
              }}
              className='mt-6'
            />
          )}

          {/* Quick Actions */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Card
              className='cursor-pointer transition-shadow hover:shadow-md'
              onClick={() => (window.location.href = '/files')}
            >
              <CardContent className='p-4 text-center'>
                <div className='text-lg font-medium'>Upload Files</div>
                <div className='text-sm text-muted-foreground'>
                  Choose audio files from your device
                </div>
              </CardContent>
            </Card>

            <Card
              className='cursor-pointer transition-shadow hover:shadow-md'
              onClick={() => (window.location.href = '/transcripts')}
            >
              <CardContent className='p-4 text-center'>
                <div className='text-lg font-medium'>View Transcripts</div>
                <div className='text-sm text-muted-foreground'>
                  See your completed transcriptions
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
