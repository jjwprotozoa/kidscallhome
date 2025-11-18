#!/bin/bash
# scripts/start-dev-with-cloudflare.sh
# Purpose: Helper script to start local dev server and Cloudflare tunnel in separate terminals
# Usage: ./scripts/start-dev-with-cloudflare.sh

# Get the project root directory (parent of scripts folder)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Starting development environment..."
echo ""
echo "This will open two separate terminal windows:"
echo "  1. Local dev server (port 8080)"
echo "  2. Cloudflare tunnel"
echo ""
echo "You can close/restart each window independently."
echo ""

# Detect OS and use appropriate terminal command
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT' && npm run dev:local\""
    sleep 2
    osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT' && npm run tunnel:cloudflare\""
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try common terminal emulators
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT' && npm run dev:local; exec bash"
        sleep 2
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT' && npm run tunnel:cloudflare; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_ROOT' && npm run dev:local" &
        sleep 2
        xterm -e "cd '$PROJECT_ROOT' && npm run tunnel:cloudflare" &
    else
        echo "Error: No supported terminal found. Please run manually:"
        echo "  Terminal 1: npm run dev:local"
        echo "  Terminal 2: npm run tunnel:cloudflare"
        exit 1
    fi
else
    echo "Error: Unsupported OS. Please run manually:"
    echo "  Terminal 1: npm run dev:local"
    echo "  Terminal 2: npm run tunnel:cloudflare"
    exit 1
fi

echo ""
echo "Both servers are starting in separate windows."
echo "Check the Cloudflare tunnel window for your public URL."
echo ""
echo "To stop:"
echo "  - Close the respective window, or"
echo "  - Press Ctrl+C in that window"

