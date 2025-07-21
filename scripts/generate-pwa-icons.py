#!/usr/bin/env python3

import os
import subprocess
from pathlib import Path

# Define the icon sizes needed for PWA
ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
SHORTCUT_SIZES = [96]  # For shortcuts

# Paths
LOGO_PATH = "public/logo.svg"
ICONS_DIR = "public/icons"

def generate_icons():
    """Generate PNG icons from SVG logo using ImageMagick (convert)"""
    
    # Check if convert is available
    try:
        subprocess.run(['convert', '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ ImageMagick 'convert' command not found.")
        print("Install with: sudo apt install imagemagick (Ubuntu/Debian) or brew install imagemagick (macOS)")
        return False
    
    # Create icons directory
    os.makedirs(ICONS_DIR, exist_ok=True)
    
    print(f"🎨 Generating PWA icons from {LOGO_PATH}...")
    
    # Generate main app icons
    for size in ICON_SIZES:
        output_file = f"{ICONS_DIR}/icon-{size}x{size}.png"
        cmd = [
            'convert',
            '-background', 'none',  # Transparent background
            '-resize', f'{size}x{size}',
            LOGO_PATH,
            output_file
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"✅ Generated {output_file}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate {output_file}: {e}")
    
    # Generate shortcut icons (simplified versions)
    shortcut_icons = [
        ("upload-shortcut-96x96.png", "📤"),  # Upload
        ("record-shortcut-96x96.png", "🎙️"),   # Record
        ("transcript-shortcut-96x96.png", "📝") # Transcript
    ]
    
    for filename, emoji in shortcut_icons:
        output_file = f"{ICONS_DIR}/{filename}"
        
        # Create a simple colored background with emoji
        cmd = [
            'convert',
            '-size', '96x96',
            '-background', '#3b82f6',  # Blue background
            '-fill', 'white',
            '-gravity', 'center',
            '-pointsize', '48',
            f'label:{emoji}',
            output_file
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"✅ Generated shortcut icon {output_file}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate {output_file}: {e}")
    
    print("🎉 PWA icon generation completed!")
    return True

def create_fallback_icons():
    """Create simple fallback icons without ImageMagick"""
    import json
    
    print("⚠️  Creating fallback approach - will use existing logo.svg")
    print("📝 You should manually create PNG icons from the SVG logo:")
    
    for size in ICON_SIZES:
        print(f"   - icon-{size}x{size}.png (from logo.svg at {size}x{size} pixels)")
    
    print("\nFor shortcuts, create these with colored backgrounds:")
    print("   - upload-shortcut-96x96.png (upload icon, 96x96)")
    print("   - record-shortcut-96x96.png (microphone icon, 96x96)")  
    print("   - transcript-shortcut-96x96.png (document icon, 96x96)")
    
    return False

if __name__ == "__main__":
    if not generate_icons():
        create_fallback_icons()