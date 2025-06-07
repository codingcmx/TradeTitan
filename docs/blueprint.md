# **App Name**: TradeWatch

## Core Features:

- Real-time Dashboard: Real-time trade monitoring dashboard using Firebase Realtime Database.
- Trade History: Historical trade log display from Firestore.
- Secure Logging: Secure logging of trade data from the external backend to Firestore.
- Config Sync: Configuration settings display, read from Firestore and applied to the backend.
- Telegram Alerts: Telegram alert triggering (via Firebase Functions) based on Firestore events.

## Style Guidelines:

- Primary color: Dark purple (#624CAB) to convey stability and seriousness appropriate for financial data.
- Background color: Very dark grey (#1E1E1E) for a modern and focused user experience, promoting long usage times without strain.
- Accent color: Electric blue (#7DF9FF) for interactive elements, providing good contrast and clear calls to action.
- Font: 'Inter' (sans-serif) for clear and readable data display across the dashboard.
- Simple, geometric icons to represent different trade types and statuses.
- Clear separation of concerns with panels for real-time data, historical logs, and configuration.
- Subtle transitions and loading animations to enhance user experience without being distracting.