# MacroFactor (personal clone)

Nutrition tracker with adaptive expenditure, weekly check-ins, barcode scanning (Open Food Facts + Israeli Ministry of Health database), and AI meal photos / nutrition-label reading.

All data is stored locally on the phone. AI features need your own Anthropic API key (console.anthropic.com), entered in the app under More.

## Run it

1. Install Node.js 22+ (https://nodejs.org).
2. In this folder:
   ```
   npm install --legacy-peer-deps
   npx expo start
   ```
3. Install **Expo Go** on your phone, sign in to a free Expo account, then scan the QR code shown in the terminal (phone and computer on the same Wi-Fi). You may need `npx expo login` with the same account on the computer.

## Run it without the computer (optional)

```
npm install -g eas-cli
eas login
eas init
eas update:configure
eas update --branch production --environment production --message "first"
```
Then open the project from Expo Go → Profile → Projects.

For an Android app you can install directly: `eas build -p android --profile preview` (free tier).
