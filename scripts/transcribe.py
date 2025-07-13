#!/usr/bin/env python3
"""
Simple transcription script using WhisperX
"""
import argparse
import json
import whisperx
import torch
import os
from pyannote.audio import Pipeline

def transcribe_audio(audio_file, model_size="base", device="cpu", compute_type="float32", enable_diarization=True, language=None):
    """Transcribe audio file using WhisperX with optional speaker diarization"""
    
    # Load model
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    
    # Load audio
    audio = whisperx.load_audio(audio_file)
    
    # Transcribe
    result = model.transcribe(audio, batch_size=16, language=language)
    
    # Align whisper output (with fallback for unsupported languages)
    try:
        model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        print("Alignment completed successfully")
        aligned = True
    except Exception as align_error:
        print(f"Warning: Alignment failed for language '{result['language']}': {align_error}")
        print("Continuing with unaligned transcription...")
        # Keep the original segments without alignment
        aligned = False
    
    # Speaker diarization (can work with or without alignment)
    if enable_diarization and os.getenv('HUGGINGFACE_TOKEN'):
        try:
            print(">>Performing speaker diarization...")
            diarize_model = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=os.getenv('HUGGINGFACE_TOKEN')
            ).to(torch.device(device))
            
            # Run diarization - pass the audio file path, not the loaded audio
            diarize_segments = diarize_model(audio_file)
            
            # Assign speakers to segments based on timestamps
            # Note: Using segment-level assignment for all cases due to compatibility issues
            for segment in result["segments"]:
                # Find overlapping diarization segment
                segment_start = segment.get("start", 0)
                segment_end = segment.get("end", segment_start + 1)
                
                # Find the speaker with most overlap
                best_speaker = "SPEAKER_00"  # default
                max_overlap = 0
                
                for turn, _, speaker in diarize_segments.itertracks(yield_label=True):
                    overlap_start = max(segment_start, turn.start)
                    overlap_end = min(segment_end, turn.end)
                    overlap = max(0, overlap_end - overlap_start)
                    
                    if overlap > max_overlap:
                        max_overlap = overlap
                        best_speaker = speaker
                
                segment["speaker"] = best_speaker
                    
            print("Speaker diarization completed successfully")
            
        except Exception as diarize_error:
            import traceback
            print(f"Warning: Speaker diarization failed: {diarize_error}")
            print(f"Error type: {type(diarize_error)}")
            traceback.print_exc()
            print("Continuing without speaker labels...")
    elif enable_diarization and not os.getenv('HUGGINGFACE_TOKEN'):
        print("Warning: HUGGINGFACE_TOKEN not set, skipping speaker diarization")
    
    return result

def main():
    parser = argparse.ArgumentParser(description='Transcribe audio using WhisperX')
    parser.add_argument('--audio-file', required=True, help='Path to audio file')
    parser.add_argument('--model-size', default='base', help='Model size (tiny, base, small, medium, large, large-v2, large-v3)')
    parser.add_argument('--device', default='cpu', help='Device to use (cpu or cuda)')
    parser.add_argument('--output-file', required=True, help='Output JSON file path')
    parser.add_argument('--language', default=None, help='Language code (e.g., sv for Swedish, en for English)')
    parser.add_argument('--enable-diarization', action='store_true', default=True, help='Enable speaker diarization')
    parser.add_argument('--disable-diarization', action='store_true', help='Disable speaker diarization')
    
    args = parser.parse_args()
    
    # Check if CUDA is available
    device = args.device
    if device == "cuda" and not torch.cuda.is_available():
        print("CUDA not available, falling back to CPU")
        device = "cpu"
    
    compute_type = "float32" if device == "cpu" else "float16"
    
    # Determine diarization setting
    enable_diarization = args.enable_diarization and not args.disable_diarization
    
    try:
        # Transcribe
        print(f"Transcribing {args.audio_file}...")
        print(f"Model: {args.model_size}")
        print(f"Language: {args.language or 'auto-detect'}")
        print(f"Speaker diarization: {'enabled' if enable_diarization else 'disabled'}")
        result = transcribe_audio(args.audio_file, args.model_size, device, compute_type, enable_diarization, args.language)
        
        # Save result
        with open(args.output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"Transcription saved to {args.output_file}")
        
    except Exception as e:
        print(f"Error: {e}")
        # Write error status
        error_file = args.output_file.replace('.json', '_status.json')
        with open(error_file, 'w') as f:
            json.dump({
                "status": "failed",
                "error": str(e)
            }, f)

if __name__ == "__main__":
    main()