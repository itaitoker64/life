# Publishing Life to the phone (for AI assistants)

**Do not run `eas` yourself.** Publishing goes through GitHub (`itaitoker64/life`),
`.github/workflows/eas-update.yml`:
- Every push to `main` runs `npm run check` + `npm run test:planning` only (no publish).
- Publishing an Android EAS Update (channel `production`) happens only when a tag
  starting with `release-` is pushed, or when the workflow is run manually
  (Actions → Check and publish → Run workflow). Publish only after the push check is green
  and the user agreed to ship.

## Rules
1. **Always start from the latest `main`** (clone/pull fresh). Never work from an old ZIP —
   an old snapshot silently reverts newer fixes (this already happened once).
2. Commit only JS/TS/asset changes. If you add a package with native code or change
   `app.json` plugins/permissions, an OTA update is NOT enough: tell the user a new APK
   build is needed (`npx eas-cli build -p android --profile preview`, run from a computer).
3. Keep the UI in Hebrew/RTL. Don't put API keys in the repo.
4. Push to `main`, wait for a green check, then `git tag release-YYYYMMDD-N && git push origin --tags`
   → the update reaches the phone. The user reopens Life twice to apply it.

If the Action fails, read its log, fix, push again.

## Runtime compatibility
`runtimeVersion` uses the **fingerprint** policy: an update only reaches APKs whose native
code matches. If a change adds/changes native modules, the Action still publishes, but the
phone will not receive it until a new APK is built and installed.
