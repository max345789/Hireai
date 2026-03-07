#!/bin/bash
# DAB AI — Local Dev Launcher
# Double-click this file to start the project

cd "$(dirname "$0")"

echo "🚀 Starting DAB AI..."
echo ""

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  read -p "Press Enter to close..."
  exit 1
fi

# Install server deps if needed
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing server dependencies..."
  cd server && npm install && cd ..
fi

# Install client deps if needed
if [ ! -d "client/node_modules" ]; then
  echo "📦 Installing client dependencies..."
  cd client && npm install && cd ..
fi

echo ""
echo "✅ Backend  → http://localhost:3001"
echo "✅ Frontend → http://localhost:5173"
echo ""
echo "Opening browser in 3 seconds..."
sleep 3
open http://localhost:5173

# Start both servers
npm run dev
