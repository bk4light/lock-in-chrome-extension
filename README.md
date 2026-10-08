# lock-in-chrome-extension
# 🔒 Lock In Zone - Chrome Extension

A Chrome extension designed to block custom URL paths (e.g., `instagram.com`, `youtube.com/shorts`) during customizable focus sessions and multi-cycle Pomodoros.

## Key Features
- **Background Timers:** Powered by `background.js` and Chrome's Alarms API to manage focus durations continuously across tab navigation.
- **State Persistence:** Preserves session state and user preferences locally via `chrome.storage.local`.
- **Customizable Modes:** Supports open-ended focus, single countdown timers, and multi-cycle Pomodoro work/rest rotations with modal browser alerts.
