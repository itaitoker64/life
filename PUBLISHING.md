# Publishing Life to the phone (for AI assistants)

**Do not run `eas` yourself.** Publishing is automatic: every push to `main` on
GitHub (`itaitoker64/life`) runs `.github/workflows/eas-update.yml`, which runs
`npm run check` + `npm run test:planning` and then publishes an Android EAS Update
(channel `production`). Watch it under the repo's **Actions** tab.

## Rules
1. **Always start from the latest `main`** (clone/pull fresh). Never work from an old ZIP —
   an old snapshot silently reverts newer fixes (this already happened once).
2. Commit only JS/TS/asset changes. If you add a package with native code or change
   `app.json` plugins/permissions, an OTA update is NOT enough: tell the user a new APK
   build is needed (`npx eas-cli build -p android --profile preview`, run from a computer).
3. Keep the UI in Hebrew/RTL. Don't put API keys in the repo.
4. Push to `main` → the update reaches the phone. The user reopens Life twice to apply it.

If the Action fails, read its log, fix, push again.

## Runtime compatibility
`runtimeVersion` uses the **fingerprint** policy: an update only reaches APKs whose native
code matches. If a change adds/changes native modules, the Action still publishes, but the
phone will not receive it until a new APK is built and installed.
