#!/usr/bin/env python3
"""
Simple transcription script using WhisperX
VERSION: 2025-07-19-SEQUENTIAL-THINKING-FIX
"""
import argparse
import json
import whisperx
import torch
import os
import subprocess
import tempfile
import time
from pathlib import Path
from pyannote.audio import Pipeline

def needs_conversion_for_diarization(audio_file):
    """Check if audio file format might cause issues with pyannote.audio"""
    extension = Path(audio_file).suffix.lower()
    # Formats that are known to cause issues with pyannote.audio
    problematic_formats = {'.m4a', '.mp4', '.webm', '.mpeg', '.mpga'}
    return extension in problematic_formats

def convert_audio_for_diarization(audio_file):
    """Convert audio file to wav format for better pyannote.audio compatibility"""
    if not needs_conversion_for_diarization(audio_file):
        return audio_file, None, None  # No conversion needed
    
    print(f">>Converting {audio_file} to wav format for diarization compatibility...")
    
    # Create temporary wav file
    temp_dir = tempfile.gettempdir()
    temp_wav = os.path.join(temp_dir, f"diarization_temp_{os.getpid()}_{int(time.time())}.wav")
    
    try:
        # Use FFmpeg to convert to wav
        # Using high quality settings to preserve audio quality for diarization
        cmd = [
            'ffmpeg', '-i', audio_file,
            '-acodec', 'pcm_s16le',  # 16-bit PCM
            '-ar', '16000',          # 16kHz sample rate (good for speech)
            '-ac', '1',              # Mono (pyannote.audio works better with mono)
            '-y',                    # Overwrite output file
            temp_wav
        ]
        
        print(f">>Running conversion command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            error_msg = f"FFmpeg conversion failed: {result.stderr}"
            print(f">>Conversion error: {error_msg}")
            return audio_file, None, error_msg  # Fall back to original file
        
        if not os.path.exists(temp_wav) or os.path.getsize(temp_wav) == 0:
            error_msg = "Conversion produced empty or missing file"
            print(f">>Conversion error: {error_msg}")
            return audio_file, None, error_msg  # Fall back to original file
        
        print(f">>Conversion successful: {temp_wav} ({os.path.getsize(temp_wav)} bytes)")
        return temp_wav, temp_wav, None  # Return converted file path and cleanup path
        
    except subprocess.TimeoutExpired:
        error_msg = "FFmpeg conversion timed out (>5 minutes)"
        print(f">>Conversion error: {error_msg}")
        # Try to cleanup partial file
        try:
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
        except:
            pass
        return audio_file, None, error_msg
    except Exception as e:
        error_msg = f"Conversion error: {str(e)}"
        print(f">>Conversion error: {error_msg}")
        return audio_file, None, error_msg

def cleanup_temp_file(temp_file_path):
    """Clean up temporary conversion file"""
    if temp_file_path and os.path.exists(temp_file_path):
        try:
            os.remove(temp_file_path)
            print(f">>Cleaned up temporary file: {temp_file_path}")
        except Exception as e:
            print(f">>Warning: Could not clean up temporary file {temp_file_path}: {e}")

def transcribe_audio(audio_file, model_size="base", device="cpu", compute_type="float32", enable_diarization=True, language=None, num_speakers=None):
    """Transcribe audio file using WhisperX with optional speaker diarization"""
    
    # Initialize diarization metadata
    diarization_metadata = {
        "attempted": False,
        "success": False,
        "error": None,
        "speaker_count": 0,
        "conversion_attempted": False,
        "conversion_success": False,
        "conversion_error": None,
        "transcription_file_used": None,
        "diarization_file_used": None
    }
    
    # Handle format conversion for diarization compatibility
    diarization_audio_file = audio_file  # Default to original file
    temp_file_to_cleanup = None
    
    if enable_diarization and needs_conversion_for_diarization(audio_file):
        print(f">>Audio format {Path(audio_file).suffix} may cause diarization issues, attempting conversion...")
        diarization_metadata["conversion_attempted"] = True
        
        converted_file, cleanup_file, conversion_error = convert_audio_for_diarization(audio_file)
        
        if conversion_error:
            print(f">>Format conversion failed: {conversion_error}")
            print(f">>Will attempt diarization with original file: {audio_file}")
            diarization_metadata["conversion_error"] = conversion_error
            # Continue with original file
        else:
            print(f">>Format conversion successful, using converted file for diarization")
            diarization_metadata["conversion_success"] = True
            diarization_audio_file = converted_file
            temp_file_to_cleanup = cleanup_file
    
    # Load model
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    
    # Determine which file to use for transcription
    # Use converted file for both transcription and diarization to ensure timestamp alignment
    transcription_audio_file = audio_file  # Default to original
    if diarization_metadata["conversion_success"]:
        transcription_audio_file = diarization_audio_file
        print(f">>Using converted file for transcription to maintain timestamp alignment")
        diarization_metadata["transcription_file_used"] = "converted"
        diarization_metadata["diarization_file_used"] = "converted"
    else:
        print(f">>Using original file for transcription")
        diarization_metadata["transcription_file_used"] = "original"
        diarization_metadata["diarization_file_used"] = "original"
    
    # Load audio
    audio = whisperx.load_audio(transcription_audio_file)
    
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
    # Use environment variable for HuggingFace token
    hf_token = os.getenv('HUGGINGFACE_TOKEN')
    if enable_diarization and hf_token:
        diarization_metadata["attempted"] = True
        try:
            print(">>Performing speaker diarization...")
            print(f">>Diarization audio file: {diarization_audio_file}")
            print(f">>File exists: {os.path.exists(diarization_audio_file)}")
            if os.path.exists(diarization_audio_file):
                print(f">>File size: {os.path.getsize(diarization_audio_file)} bytes")
            
            diarize_model = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token
            ).to(torch.device(device))
            
            # Run diarization - use the converted file if available
            if num_speakers and num_speakers > 1:
                print(f">>Using specified number of speakers: {num_speakers}")
                diarize_segments = diarize_model(diarization_audio_file, num_speakers=num_speakers)
            else:
                print(">>Auto-detecting number of speakers...")
                diarize_segments = diarize_model(diarization_audio_file)
                
            # 🔥 ROBUST SPEAKER DETECTION - Fix the unpacking issue
            detected_speakers = set()
            segment_count = 0
            print(f">>🚀 SUPER SAIYAN: Analyzing diarization output structure...")
            
            try:
                print(f">>🔥 SEQUENTIAL THINKING: Bulletproof diarization iteration v2025-07-19")
                
                for item in diarize_segments.itertracks(yield_label=True):
                    segment_count += 1
                    
                    # 🔥 BULLETPROOF UNPACKING - Handle ANY format defensively
                    try:
                        # Convert to list to handle any iterable format
                        item_list = list(item)
                        print(f">>🔍 Item {segment_count}: type={type(item)}, len={len(item_list)}, content={item_list[:2]}")
                        
                        if len(item_list) >= 2:
                            turn = item_list[0]
                            speaker = item_list[-1]  # Last item is always speaker
                            
                            # Validate turn object has start/end
                            if hasattr(turn, 'start') and hasattr(turn, 'end'):
                                detected_speakers.add(str(speaker))
                                print(f">>✅ Segment: {turn.start:.2f}s - {turn.end:.2f}s -> {speaker}")
                            else:
                                print(f">>⚠️ Invalid turn object: {turn}")
                        else:
                            print(f">>⚠️ Item too short: {item_list}")
                            
                    except Exception as item_error:
                        print(f">>❌ Failed to process item: {item_error}")
                        continue
                    
            except Exception as e:
                import traceback
                print(f">>❌ SUPER SAIYAN: Speaker detection failed: {e}")
                print(f">>❌ SUPER SAIYAN: Full traceback: {traceback.format_exc()}")
                # PROPER FAILURE HANDLING - Don't fake speakers
                detected_speakers = set()
                diarization_metadata["error"] = f"Speaker detection failed: {str(e)}"
                
            print(f">>Detected {len(detected_speakers)} unique speakers: {sorted(detected_speakers)}")
            print(f">>Total diarization segments: {segment_count}")
            
            # 🔥 SUPER SAIYAN SPEAKER ASSIGNMENT ALGORITHM 🔥
            print(f">>🚀 SUPER SAIYAN: Advanced speaker assignment for {len(result['segments'])} transcript segments")
            print(f">>🚀 SUPER SAIYAN: Detected speakers: {sorted(detected_speakers)}")
            
            # 🔥 PHASE 1: Extract and validate diarization data
            diarization_turns = []
            print(f">>🚀 SUPER SAIYAN: Extracting diarization segments...")
            
            try:
                print(f">>🚀 SUPER SAIYAN: Analyzing diarization segment structure...")
                
                # 🔥 BULLETPROOF SEGMENT EXTRACTION - Same defensive approach
                print(f">>🔥 SEQUENTIAL THINKING: Bulletproof segment extraction v2025-07-19")
                
                for item in diarize_segments.itertracks(yield_label=True):
                    try:
                        # Convert to list to handle any iterable format
                        item_list = list(item)
                        
                        if len(item_list) >= 2:
                            turn = item_list[0]
                            speaker = item_list[-1]  # Last item is always speaker
                            
                            # Validate and extract timing
                            if hasattr(turn, 'start') and hasattr(turn, 'end'):
                                start_time = float(turn.start)
                                end_time = float(turn.end)
                                speaker_label = str(speaker)
                                
                                # Validate segment timing
                                if start_time >= 0 and end_time > start_time:
                                    diarization_turns.append({
                                        'start': start_time,
                                        'end': end_time, 
                                        'speaker': speaker_label,
                                        'duration': end_time - start_time
                                    })
                                    
                                    # Debug first few segments
                                    if len(diarization_turns) <= 3:
                                        print(f">>✅ Valid segment {len(diarization_turns)}: {start_time:.2f}-{end_time:.2f}s -> {speaker_label}")
                                else:
                                    print(f">>⚠️ Invalid timing: {start_time}-{end_time} for {speaker_label}")
                            else:
                                print(f">>⚠️ Turn missing start/end: {turn}")
                        else:
                            print(f">>⚠️ Item too short for extraction: {len(item_list)}")
                            
                    except Exception as extract_error:
                        print(f">>❌ Extraction failed: {extract_error}")
                        continue
                
                print(f">>✅ SUPER SAIYAN: Extracted {len(diarization_turns)} valid diarization segments")
                
                # Show sample diarization data
                for i, turn in enumerate(diarization_turns[:5]):
                    print(f">>  Turn {i}: {turn['start']:.2f}s-{turn['end']:.2f}s -> {turn['speaker']} ({turn['duration']:.2f}s)")
                if len(diarization_turns) > 5:
                    print(f">>  ... and {len(diarization_turns) - 5} more turns")
                
            except Exception as e:
                import traceback
                print(f">>❌ SUPER SAIYAN: Diarization extraction failed: {e}")
                print(f">>❌ SUPER SAIYAN: Traceback: {traceback.format_exc()}")
                # Fallback to simple assignment
                diarization_turns = []
            
            # 🔥 PHASE 2: Check if diarization actually worked
            if not detected_speakers:
                print(f">>❌ SUPER SAIYAN: No speakers detected - diarization failed!")
                print(f">>🚀 SUPER SAIYAN: Marking all segments as single speaker (no diarization)")
                
                # When diarization fails, don't pretend it worked - mark segments properly
                for segment in result["segments"]:
                    segment["speaker"] = None  # No speaker assignment
                
                # Update metadata to reflect failure
                diarization_metadata["success"] = False
                diarization_metadata["speaker_count"] = 0
                if not diarization_metadata.get("error"):
                    diarization_metadata["error"] = "No speakers detected in diarization output"
                
                print(f">>❌ SUPER SAIYAN: Diarization marked as failed - no fake speaker assignments")
                
            else:
                # 🔥 PHASE 3: Advanced speaker assignment with multiple strategies
                print(f">>🚀 SUPER SAIYAN: Starting advanced assignment algorithm...")
                assignment_debug = {speaker: 0 for speaker in detected_speakers}
                speaker_list = sorted(detected_speakers)
                successful_assignments = 0
                fallback_assignments = 0
                
                for i, segment in enumerate(result["segments"]):
                    segment_start = segment.get("start", 0)
                    segment_end = segment.get("end", segment_start + 1)
                    segment_duration = segment_end - segment_start
                    
                    assigned_speaker = None
                    assignment_method = "unassigned"
                    assignment_confidence = 0.0
                
                    # 🔥 STRATEGY 1: Maximum overlap assignment
                    if diarization_turns and assigned_speaker is None:
                        best_overlap = 0
                        best_speaker = None
                        overlap_debug = []
                    
                    for turn in diarization_turns:
                        # Calculate overlap
                        overlap_start = max(segment_start, turn['start'])
                        overlap_end = min(segment_end, turn['end'])
                        overlap_duration = max(0, overlap_end - overlap_start)
                        overlap_ratio = overlap_duration / segment_duration if segment_duration > 0 else 0
                        
                        overlap_debug.append(f"{turn['speaker']}:{overlap_duration:.2f}s({overlap_ratio:.1%})")
                        
                        if overlap_duration > best_overlap:
                            best_overlap = overlap_duration
                            best_speaker = turn['speaker']
                    
                    if best_overlap > 0:
                        assigned_speaker = best_speaker
                        assignment_method = "overlap"
                        assignment_confidence = best_overlap / segment_duration
                        successful_assignments += 1
                        
                        # Debug first few successful overlaps
                        if i < 3:
                            print(f">>  ✅ Segment {i}: {segment_start:.2f}-{segment_end:.2f}s -> {assigned_speaker}")
                            print(f">>     Overlaps: {', '.join(overlap_debug)}")
                            print(f">>     Best overlap: {best_overlap:.2f}s ({assignment_confidence:.1%})")
                
                    # 🔥 STRATEGY 2: Closest speaker fallback
                    if assigned_speaker is None and diarization_turns:
                        min_distance = float('inf')
                        closest_speaker = None
                        
                        for turn in diarization_turns:
                            # Calculate distance to closest point
                            if segment_end <= turn['start']:
                                distance = turn['start'] - segment_end
                            elif segment_start >= turn['end']:
                                distance = segment_start - turn['end']
                            else:
                                distance = 0  # This should have been caught by overlap
                            
                            if distance < min_distance:
                                min_distance = distance
                                closest_speaker = turn['speaker']
                    
                        if closest_speaker:
                            assigned_speaker = closest_speaker
                            assignment_method = "closest"
                            assignment_confidence = 1.0 / (1.0 + min_distance)  # Closer = higher confidence
                            fallback_assignments += 1
                            
                            if i < 3:
                                print(f">>  🔄 Segment {i}: No overlap, using closest speaker {assigned_speaker} (distance: {min_distance:.2f}s)")
                
                    # 🔥 STRATEGY 3: Time-based fallback (last resort)
                    if assigned_speaker is None:
                        if len(speaker_list) == 2:
                            # Split at midpoint for 2 speakers
                            total_duration = result["segments"][-1].get("end", 0) if result["segments"] else 0
                            midpoint = total_duration / 2
                            assigned_speaker = speaker_list[0] if segment_start < midpoint else speaker_list[1]
                        else:
                            # Round-robin for other cases
                            assigned_speaker = speaker_list[i % len(speaker_list)]
                    
                        assignment_method = "time_fallback"
                        assignment_confidence = 0.5
                        fallback_assignments += 1
                        
                        if i < 3:
                            print(f">>  ⚠️ Segment {i}: Using time-based fallback -> {assigned_speaker}")
                
                    # 🔥 FINAL SAFETY NET
                    if assigned_speaker is None:
                        assigned_speaker = speaker_list[0] if speaker_list else "SPEAKER_00"
                        assignment_method = "emergency_fallback"
                        assignment_confidence = 0.1
                
                    # Apply assignment
                    segment["speaker"] = assigned_speaker
                    segment["_assignment_method"] = assignment_method  # For debugging
                    segment["_assignment_confidence"] = assignment_confidence
                    assignment_debug[assigned_speaker] += 1

            # 🔥 PHASE 4: Report results
            print(f">>🚀 SUPER SAIYAN: Assignment completed!")
            print(f">>  ✅ Successful overlap assignments: {successful_assignments}")
            print(f">>  🔄 Fallback assignments: {fallback_assignments}")
            print(f">>  📊 Speaker distribution:")
            for speaker, count in assignment_debug.items():
                percentage = (count / len(result["segments"])) * 100
                print(f">>    {speaker}: {count} segments ({percentage:.1f}%)")
            print(f">>  🎯 Total segments assigned: {sum(assignment_debug.values())}")
            
            # Clean up debug metadata from segments
            for segment in result["segments"]:
                if "_assignment_method" in segment:
                    del segment["_assignment_method"]
                if "_assignment_confidence" in segment:
                    del segment["_assignment_confidence"]
                    
            print("Speaker diarization completed successfully")
            diarization_metadata["success"] = True
            diarization_metadata["speaker_count"] = len(detected_speakers)
            
        except Exception as diarize_error:
            import traceback
            print(f"Warning: Speaker diarization failed: {diarize_error}")
            print(f"Error type: {type(diarize_error)}")
            traceback.print_exc()
            print("Continuing without speaker labels...")
            diarization_metadata["error"] = str(diarize_error)
    elif enable_diarization and not hf_token:
        print("Warning: HUGGINGFACE_TOKEN not available, skipping speaker diarization")
        diarization_metadata["error"] = "HUGGINGFACE_TOKEN not available"
    
    # Add diarization metadata to result
    result["diarization_metadata"] = diarization_metadata
    
    # Cleanup temporary conversion file
    if temp_file_to_cleanup:
        cleanup_temp_file(temp_file_to_cleanup)
    
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
    parser.add_argument('--num-speakers', type=int, default=None, help='Number of speakers (optional, auto-detect if not specified)')
    
    args = parser.parse_args()
    
    # Debug environment variables
    print(f"Environment check:")
    print(f"  HUGGINGFACE_TOKEN: {'SET' if os.getenv('HUGGINGFACE_TOKEN') else 'NOT SET'}")
    print(f"  LD_LIBRARY_PATH: {os.getenv('LD_LIBRARY_PATH', 'NOT SET')}")
    print(f"  CUDA_VISIBLE_DEVICES: {os.getenv('CUDA_VISIBLE_DEVICES', 'NOT SET')}")
    
    # Check if CUDA is available
    device = args.device
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU count: {torch.cuda.device_count()}")
        if torch.cuda.device_count() > 0:
            print(f"GPU name: {torch.cuda.get_device_name(0)}")
    
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
        if args.num_speakers:
            print(f"Number of speakers: {args.num_speakers}")
        result = transcribe_audio(args.audio_file, args.model_size, device, compute_type, enable_diarization, args.language, args.num_speakers)
        
        # Extract diarization metadata before saving
        diarization_metadata = result.pop("diarization_metadata", {})
        
        # Save result (without metadata)
        with open(args.output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"Transcription saved to {args.output_file}")
        
        # Write metadata about diarization status
        metadata_file = args.output_file.replace('.json', '_metadata.json')
        # 🔥 SUPER SAIYAN: Robust metadata creation with error handling
        try:
            # Safe speaker count calculation
            segments = result.get("segments", [])
            speakers_in_result = set()
            for s in segments:
                speaker = s.get("speaker")
                if speaker:
                    speakers_in_result.add(speaker)
            
            print(f">>🚀 SUPER SAIYAN: Metadata calculation - found {len(speakers_in_result)} speakers in result")
            
            metadata = {
                "status": "success",
                "has_speakers": len(speakers_in_result) > 0,
                "speaker_count": len(speakers_in_result),
                "diarization_enabled": enable_diarization,
                "diarization_attempted": diarization_metadata.get("attempted", False),
                "diarization_success": diarization_metadata.get("success", False),
                "diarization_error": diarization_metadata.get("error"),
                "detected_speakers": diarization_metadata.get("speaker_count", 0),
                "format_conversion_attempted": diarization_metadata.get("conversion_attempted", False),
                "format_conversion_success": diarization_metadata.get("conversion_success", False),
                "format_conversion_error": diarization_metadata.get("conversion_error"),
                "transcription_file_used": diarization_metadata.get("transcription_file_used"),
                "diarization_file_used": diarization_metadata.get("diarization_file_used")
            }
            
            print(f">>✅ SUPER SAIYAN: Metadata created successfully")
            
        except Exception as metadata_error:
            print(f">>❌ SUPER SAIYAN: Metadata creation failed: {metadata_error}")
            # Fallback metadata
            metadata = {
                "status": "success",
                "has_speakers": False,
                "speaker_count": 1,
                "diarization_enabled": enable_diarization,
                "diarization_attempted": False,
                "diarization_success": False,
                "diarization_error": f"Metadata creation failed: {str(metadata_error)}",
                "detected_speakers": 0
            }
        
        try:
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            print(f"Metadata saved to {metadata_file}")
        except Exception as meta_error:
            print(f"Warning: Failed to write metadata file: {meta_error}")
            # Try to at least create a minimal metadata file
            try:
                minimal_metadata = {"status": "success", "metadata_error": str(meta_error)}
                with open(metadata_file, 'w') as f:
                    json.dump(minimal_metadata, f)
            except:
                print(f"Error: Could not create metadata file at all")
        
    except Exception as e:
        print(f"Error: {e}")
        # Write error metadata (use same filename pattern as success case)
        metadata_file = args.output_file.replace('.json', '_metadata.json')
        metadata = {
            "status": "failed",
            "has_speakers": False,
            "speaker_count": 0,
            "diarization_enabled": enable_diarization,
            "diarization_attempted": False,
            "diarization_success": False,
            "diarization_error": f"Transcription failed: {str(e)}",
            "detected_speakers": 0,
            "error": str(e)
        }
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"Error metadata saved to {metadata_file}")

if __name__ == "__main__":
    main()