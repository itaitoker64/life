# Life screen design · 6 October 2026

Scope: approved home concept, then training, nutrition and progress; shared visual primitives improve supporting screens. No changes to AI requests, key sanitation, equipment recognition, native modules or training prescriptions.

## Research and product decisions

- [MacroFactor dashboard](https://macrofactor.com/dashboard-revamp/): actionable daily nutrition, consumed/remaining context, fast logging and trends. Life home emphasizes calories and protein, while the food diary retains all macros. Neutral language for above-target days; no invented compliance or readiness score.
- [Hevy workout tracking](https://www.hevyapp.com/features/track-workouts/): minimize friction between a routine and starting/logging. Life gives the scheduled workout one primary action and retains a persistent resume bar. A completed/replaced session must not be offered again.
- [Hevy statistics](https://help.hevyapp.com/hc/en-us/articles/35702030346903-Hevy-Statistics-Explained-Track-Your-Training-Progress-and-Muscle-Growth): period-based training summaries and deeper performance breakdowns. Life separates overview, nutrition/weight and performance, preserving detailed graphs without placing them all on the landing view.
- [Fitbod gym profiles](https://fitbod.me/blog/your-gym-profile/): equipment and context matter for workout personalization. Life links the day's actual strength/CrossFit session directly into its existing gym photo adaptation flow; this remains a one-off adaptation, not a silent change to the whole routine.
- [Garmin workout calendar](https://support.garmin.com/en-IN/?faq=XRcMvEtKdf7yBf8My9jua6): planned workouts belong in a calendar. Life uses one journal for strength, running and CrossFit, with details available from each day on the home strip.

These are interaction principles, not claims of pixel-for-pixel parity or comparative usability testing. The approved image is a concept with fictional numbers; implementation derives every number from local app data.

## Hierarchy

Home: actual scheduled/active workout → today's nutrition → photo/weigh/alternate workout → week → weight trend. Rest, completion, adjusted load, loading and missing-data states are explicit. Future days never get completion checkmarks.

Training: journal first, strength and running drill-down tabs. Scheduling and alternate workout logging stay visible; program controls, gym photo adaptation, reminders and adaptation settings are grouped under options.

Nutrition: date navigation, daily macro overview, food/photo entry, then meal groups with existing search/barcode/photo and drag-to-move. Each flow preserves selected date and meal.

Progress: overview for weekly review and goals; nutrition/weight for intake, expenditure and weight; performance for longer-term training charts and records.

Navigation: four equally sized tabs, no floating plus. Android bottom inset and persistent active workout resume remain intact. Settings remains on home. Existing deep links remain available.

## Visual system

Charcoal surfaces, restrained periwinkle primary, teal running and orange CrossFit. Rounded cards, quiet borders, readable muted text, 44px minimum primary/segmented targets. Main buttons use a darker accessible blue with white text; the brighter accent is used for icons and text on dark surfaces. Hebrew RTL; color always accompanies a label/icon/status.

## Concurrency and release

Implemented in a separate git worktree based on abc5806 (including Claude's AI key/network fixes and Health Connect changes). Re-fetch and integrate latest main before publishing; never force push. This change introduces no native dependency or app config modification. Existing fingerprint runtime from main still determines which installed APK receives an OTA.

## Verification

- TypeScript check and all 48 planning tests passed.
- Android production bundle exported successfully (no native build changes).
- Chromium preview at 390×844 and 320×740: RTL four-tab navigation, empty/rest home, scheduled CrossFit home, gym adaptation source, nutrition diary, progress filters and weekly chart layout.
- Created a test profile and activated a hybrid plan through UI; home immediately reflected the day's CrossFit session.
- Started that CrossFit session, minimized it and returned home: primary action became Resume and the persistent active-workout bar remained available.
- Logged 100g banana to yesterday's breakfast through UI: date/meal parameters and stored diary entry matched. Empty days remain distinct from recorded intake.
- Browser reported no uncaught errors. Camera hardware, Health Connect and OTA receipt were not tested on a physical Android phone in this environment.
- Integrated Claude's subsequent e080498 Gemini support commit without conflicts. His AI/key/settings changes are preserved.
