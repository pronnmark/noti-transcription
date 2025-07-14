#!/bin/bash

# Kill any process on port 5173
echo "🔍 Checking for processes on port 5173..."
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚡ Killing existing process on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "🚀 Starting development server..."
npm run dev