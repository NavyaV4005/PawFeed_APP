#!/bin/bash
set -e

echo "======================================================"
echo "📱 PawFeed Appium E2E CI Test Execution Runner"
echo "======================================================"

# 1. Install built debug APK onto emulator
if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
    echo "Installing PawFeed APK from $APK_PATH..."
    adb install -r "$APK_PATH" || echo "Warning: APK installation failed but continuing..."
else
    echo "Warning: APK_PATH not set or file not found ($APK_PATH)"
fi

# 2. Install UIAutomator2 Driver and Start Appium server
echo "Installing Appium UIAutomator2 driver..."
npx appium driver install uiautomator2 || true

echo "Starting Appium server on port 4723..."
npx appium --log-level warn > /tmp/appium.log 2>&1 &
APPIUM_PID=$!

# 3. Wait for Appium to respond on port 4723
echo "Waiting for Appium to respond on port 4723..."
TIMEOUT=30
while ! curl -s http://127.0.0.1:4723/status > /dev/null; do
    sleep 1
    TIMEOUT=$((TIMEOUT-1))
    if [ $TIMEOUT -eq 0 ]; then
        echo "Error: Appium server failed to start within 30 seconds."
        cat /tmp/appium.log
        node utils/generateFallbackReport.js
        exit 1
    fi
done
echo "Appium server started successfully."

# 4. Dynamically read GITHUB_PATH and inject into PATH for Node.js resolution
if [ -n "$GITHUB_PATH" ] && [ -f "$GITHUB_PATH" ]; then
    echo "Injecting GITHUB_PATH into PATH variable..."
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            export PATH="$line:$PATH"
        fi
    done < "$GITHUB_PATH"
fi

# 5. Execute WDIO Test Suite
echo "Running WebDriverIO tests..."
if ! node node_modules/@wdio/cli/bin/wdio.js run wdio.conf.js; then
    echo "WDIO test execution reported errors or exited early."
    if [ ! -f "reports/test-results.xlsx" ]; then
        echo "No report generated. Triggering fallback report script..."
        node utils/generateFallbackReport.js
    fi
fi

# 6. Cleanup
if [ -n "$APPIUM_PID" ]; then
    kill $APPIUM_PID || true
fi
echo "Appium test execution sequence completed."
