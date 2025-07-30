import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { toast } from 'sonner';
import type { LocationData } from '@/lib/services/locationService';

// Recording workflow phases
export type WorkflowPhase =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'completed'
  | 'error';

// Transcription status from API
export interface TranscriptionStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  transcript?: string | TranscriptSegment[];
  error?: string;
  speakerCount?: number;
  diarizationStatus?: string;
}

interface TranscriptSegment {
  speaker?: string;
  text: string;
  start?: number;
  end?: number;
}

interface RecordingState {
  // Core recording states
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];

  // Audio level monitoring
  audioLevel: number;
  audioAnalyser: AnalyserNode | null;
  levelAnimationFrame: number | null;

  // Device and support
  recordingSupported: boolean;
  supportError: string;
  deviceInfo: string;
  isMobile: boolean;

  // Upload and transcription workflow
  workflowPhase: WorkflowPhase;
  uploadProgress: number;
  transcriptionProgress: number;
  fileId: number | null;
  transcript: string | null;
  error: string | null;

  // Settings
  speakerCount: number;

  // Location tracking
  locationData: LocationData | null;
  isLocationTracking: boolean;

  // Wake lock and auto-save
  wakeLock: WakeLockSentinel | null;
  lastAutoSave: Date | null;
  autoSaveCounter: number;

  // Actions
  setRecordingState: (isRecording: boolean, isPaused?: boolean) => void;
  setRecordingTime: (time: number) => void;
  setMediaRecorder: (recorder: MediaRecorder | null) => void;
  setAudioChunks: (chunks: Blob[]) => void;

  setAudioLevel: (level: number) => void;
  setAudioAnalyser: (analyser: AnalyserNode | null) => void;
  setLevelAnimationFrame: (frame: number | null) => void;

  setRecordingSupport: (
    supported: boolean,
    error?: string,
    deviceInfo?: string
  ) => void;
  setIsMobile: (mobile: boolean) => void;

  setWorkflowPhase: (phase: WorkflowPhase) => void;
  setUploadProgress: (progress: number) => void;
  setTranscriptionProgress: (progress: number) => void;
  setFileId: (id: number | null) => void;
  setTranscript: (transcript: string | null) => void;
  setError: (error: string | null) => void;

  setSpeakerCount: (count: number) => void;

  setLocationData: (data: LocationData | null) => void;
  setLocationTracking: (tracking: boolean) => void;

  setWakeLock: (lock: WakeLockSentinel | null) => void;
  setAutoSaveData: (lastSave: Date | null, counter: number) => void;

  // Workflow actions
  resetWorkflow: () => void;
  startTranscriptionPolling: (fileId: number) => void;
  stopTranscriptionPolling: () => void;
  updateTranscriptionStatus: (status: TranscriptionStatus) => void;
}

// Polling interval ID for transcription status
let pollingInterval: NodeJS.Timeout | null = null;

export const useRecordingStore = create<RecordingState>()(
  devtools(
    (set, get) => ({
      // Initial states
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      mediaRecorder: null,
      audioChunks: [],

      audioLevel: 0,
      audioAnalyser: null,
      levelAnimationFrame: null,

      recordingSupported: true,
      supportError: '',
      deviceInfo: '',
      isMobile: false,

      workflowPhase: 'idle',
      uploadProgress: 0,
      transcriptionProgress: 0,
      fileId: null,
      transcript: null,
      error: null,

      speakerCount: 2,

      locationData: null,
      isLocationTracking: false,

      wakeLock: null,
      lastAutoSave: null,
      autoSaveCounter: 0,

      // Basic setters
      setRecordingState: (isRecording, isPaused = false) =>
        set({ isRecording, isPaused }),

      setRecordingTime: time => set({ recordingTime: time }),

      setMediaRecorder: recorder => set({ mediaRecorder: recorder }),

      setAudioChunks: chunks => set({ audioChunks: chunks }),

      setAudioLevel: level => set({ audioLevel: level }),

      setAudioAnalyser: analyser => set({ audioAnalyser: analyser }),

      setLevelAnimationFrame: frame => set({ levelAnimationFrame: frame }),

      setRecordingSupport: (supported, error = '', deviceInfo = '') =>
        set({ recordingSupported: supported, supportError: error, deviceInfo }),

      setIsMobile: mobile => set({ isMobile: mobile }),

      setWorkflowPhase: phase => set({ workflowPhase: phase }),

      setUploadProgress: progress => set({ uploadProgress: progress }),

      setTranscriptionProgress: progress =>
        set({ transcriptionProgress: progress }),

      setFileId: id => set({ fileId: id }),

      setTranscript: transcript => set({ transcript }),

      setError: error => set({ error }),

      setSpeakerCount: count => set({ speakerCount: count }),

      setLocationData: data => set({ locationData: data }),

      setLocationTracking: tracking => set({ isLocationTracking: tracking }),

      setWakeLock: lock => set({ wakeLock: lock }),

      setAutoSaveData: (lastSave, counter) =>
        set({ lastAutoSave: lastSave, autoSaveCounter: counter }),

      // Workflow actions
      resetWorkflow: () => {
        // Stop any ongoing polling
        get().stopTranscriptionPolling();

        set({
          workflowPhase: 'idle',
          uploadProgress: 0,
          transcriptionProgress: 0,
          fileId: null,
          transcript: null,
          error: null,
          isRecording: false,
          isPaused: false,
          recordingTime: 0,
          audioLevel: 0,
          lastAutoSave: null,
          autoSaveCounter: 0,
        });
      },

      startTranscriptionPolling: fileId => {
        // Clear any existing polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Starting transcription polling for file ${fileId}`);
        }

        const pollTranscription = async () => {
          try {
            const response = await fetch(`/api/transcription-status/${fileId}`);
            if (!response.ok) {
              throw new Error(`Status check failed: ${response.status}`);
            }

            const status: TranscriptionStatus = await response.json();
            get().updateTranscriptionStatus(status);

            // Stop polling if completed or failed
            if (status.status === 'completed' || status.status === 'failed') {
              get().stopTranscriptionPolling();
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Transcription polling error:', error);
            }
            set({
              error:
                error instanceof Error ? error.message : 'Status check failed',
              workflowPhase: 'error',
            });
            get().stopTranscriptionPolling();
          }
        };

        // Poll immediately, then every 3 seconds
        pollTranscription();
        pollingInterval = setInterval(pollTranscription, 3000);
      },

      stopTranscriptionPolling: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          if (process.env.NODE_ENV === 'development') {
            console.log('⏹️ Stopped transcription polling');
          }
        }
      },

      updateTranscriptionStatus: status => {
        const { workflowPhase } = get();

        // Update progress
        set({ transcriptionProgress: status.progress });

        // Handle status changes
        switch (status.status) {
          case 'pending':
            if (workflowPhase === 'uploading') {
              set({ workflowPhase: 'transcribing' });
              toast.info('Transcription started...');
            }
            break;

          case 'processing':
            set({ workflowPhase: 'transcribing' });
            break;

          case 'completed':
            // Convert transcript array to JSON string for the viewer component
            const transcriptString = status.transcript
              ? Array.isArray(status.transcript)
                ? JSON.stringify(status.transcript)
                : status.transcript
              : null;

            set({
              workflowPhase: 'completed',
              transcript: transcriptString,
              transcriptionProgress: 100,
            });
            toast.success('Transcription completed!');
            break;

          case 'failed':
            set({
              workflowPhase: 'error',
              error: status.error || 'Transcription failed',
            });
            toast.error(
              'Transcription failed: ' + (status.error || 'Unknown error'),
            );
            break;
        }
      },
    }),
    {
      name: 'recording-store',
    },
  ),
);
