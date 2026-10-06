# Life — handoff for publishing the phone update

The source in this folder includes the user's approved changes. They have already authorized publishing to the phone; no further publication confirmation is needed.

## Changes ready to publish

- Training journal for strength and running, with past/upcoming workouts and filters.
- Recurring weekly schedules and one-off sessions; move or cancel one occurrence without changing the series.
- Visual nutrition/training goal progress and a combined weekly planned-versus-completed review.
- Trends across the last four complete weeks, with nutrition logging coverage shown explicitly.
- Configurable local workout reminders and up to three daily meal-logging reminders. The user enables notifications and selects times on the phone.
- Planning preferences are stored in SQLite documents and included in existing backups.

No native dependencies or native configuration were added. This is an Android EAS Update for the existing SDK 57 runtime.

## Validation completed

- `npm run check` passed.
- `TZ=Asia/Jerusalem npm run test:planning` passed: 14 tests covering recurrence, moves/cancellations, matching, summaries, persistence, and notification reconciliation.
- Final Android export passed.
- Browser checked at a 390px viewport: journal, schedule persistence, moving an occurrence into another week, weekly review, trends, reminders, and no horizontal overflow. A React SVG warning found in the ring was fixed and rechecked.
- Native notification delivery still needs a physical-phone check.

## Publish from a computer with access to Expo

From this project folder:

```bash
npm ci --legacy-peer-deps
npx eas-cli login
npx eas-cli whoami
npm run check
npm run test:planning
EAS_NO_VCS=1 npx eas-cli update --channel production --environment production --platform android --message "Training journal, weekly planning, goals, reminders and monthly trends" --non-interactive
```

`EAS_NO_VCS=1` allows publishing the ZIP extraction without its original Git directory. If using the original repository, it can be omitted.

Verify the Expo account has access to:

- Owner: `itaitoker64`
- Project slug: `macrofactor`
- EAS project ID: `0e6e7768-0598-4bfa-b8fa-ab6715e0d8f4`
- Update channel: `production` (both existing build profiles use this channel)
- Environment: `production` (required by current EAS CLI for SDK 57)
- Android package: `com.life.app`
- Runtime policy: `sdkVersion`

After publishing, retain the returned update group ID and dashboard URL and verify Android, runtime, and production channel. On the phone, reopen Life with internet access, allow the update to download, and reopen again to use it. Check **אימון → יומן**, **התקדמות**, and **הגדרות → תזכורות**.

## Previous environment blocker

Nothing has been published yet. The chat's cloud environment is not logged into Expo, and its outbound proxy blocks `api.expo.dev` with HTTP 403. These were environment/access blockers; publishing from a normal authenticated computer avoids that cloud setup dependency.
