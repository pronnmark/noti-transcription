#!/bin/bash

# Start Noti with HTTPS support via Caddy
# This enables microphone access on mobile devices

cd /home/philip/Documents/projects/noti

echo "🚀 Starting Noti with HTTPS support..."

# Kill any existing processes
echo "Stopping existing servers..."
pkill -f "next dev -p 5173" || true
pkill -f "caddy run" || true

# Wait a moment for processes to stop
sleep 2

# Start Next.js development server
echo "Starting Next.js server..."
npm run dev &
NEXT_PID=$!

# Wait for Next.js to start
echo "Waiting for Next.js to start..."
sleep 5

# Start Caddy with HTTPS proxy
echo "Starting Caddy HTTPS proxy..."
caddy run --config Caddyfile &
CADDY_PID=$!

# Wait for Caddy to start
sleep 3

echo ""
echo "✅ Noti is now running with HTTPS support!"
echo ""
echo "🌐 Access URLs:"
echo "  • Local HTTPS:    https://localhost:8443"
echo "  • Network HTTPS:  https://192.168.0.110:8443"
echo "  • Local HTTP:     http://localhost:8080 (redirects to HTTPS)"
echo "  • Network HTTP:   http://192.168.0.110:8080 (redirects to HTTPS)"
echo ""
echo "📱 Mobile Access:"
echo "  • iPhone Safari:  https://192.168.0.110:8443"
echo "  • Android Chrome: https://192.168.0.110:8443"
echo ""
echo "⚠️  You'll see a security warning for self-signed certificate"
echo "   Click 'Advanced' → 'Proceed to 192.168.0.110 (unsafe)'"
echo ""
echo "🎤 Microphone permissions will work properly with HTTPS!"
echo ""
echo "📊 Services:"
echo "  • Next.js PID: $NEXT_PID"
echo "  • Caddy PID:   $CADDY_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $NEXT_PID 2>/dev/null || true
    kill $CADDY_PID 2>/dev/null || true
    pkill -f "next dev -p 5173" || true
    pkill -f "caddy run" || true
    echo "✅ All services stopped"
    exit 0
}

# Trap signals and cleanup
trap cleanup SIGINT SIGTERM

# Wait for processes
wait $NEXT_PID $CADDY_PID