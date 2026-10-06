# Combined training and spontaneous gyms

The starting weight-loss split is two full-body strength sessions, two easy aerobic
sessions and one controlled CrossFit session, separated by easy/rest days. Returning
trainees get two working sets, 25-minute run/walk sessions and technical CrossFit;
regular trainees get 2–3 sets, 35-minute easy runs and controlled CrossFit. The days
are editable. This split is a practical starting choice, not an exact regimen
validated by a single trial. Nutrition goals are not changed or increased after a WOD.

Evidence informing that choice:
- Aerobic dose-response, 116 trials: https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828487
- Resistance exercise during dietary weight loss preserves fat-free mass and supports fat loss:
  https://bmjopensem.bmj.com/content/11/3/e002363
- HIIT is not necessarily better than continuous aerobic exercise for body-fat reduction:
  https://pubmed.ncbi.nlm.nih.gov/37927356/
- Concurrent strength/aerobic training is generally compatible with maximal strength and hypertrophy:
  https://pubmed.ncbi.nlm.nih.gov/34757594/

Aerobic volume can build gradually toward 150–300 minutes weekly, including brisk
walking. The entire length of a CrossFit class is not credited as aerobic minutes.
Easy runs use conversation effort; an old interval pace is never copied into them.
Existing race plans and explicit manual moves are preserved. Existing manual rules
remain visible and can be cancelled in the journal. Versions of the split are retained
so changing it does not rewrite earlier weeks. Underlying run-coach plans stay intact.

Recovery is a conservative scheduling heuristic, not a physiological prediction.
It uses completed workouts, reported/estimated duration, perceived effort and body
areas, including accumulated same-day load. Easy aerobic work can accompany controlled
strength/CrossFit; very hard or accumulated work still triggers recovery. The seven-day
window can move flexible workouts onto empty days or reduce their active copy. Fixed
CrossFit classes stay on their weekday with an explicit lighter/rest alternative.
Manual moves and race-adjacent sessions are protected; adjustments can be undone.
Missing movements are not added as compensatory workouts.

The gym flow selects the source session, accepts 1–3 photos or manual equipment input,
then asks the user to confirm the inventory and space constraints. Gemini identifies
only catalogue equipment with confidence/evidence; it never writes exercise IDs, sets
or weights. Uncertain observations require manual selection. Photos are resized to a
maximum dimension of 1280 and sent only when identification is requested. The API key
uses the existing on-device Gemini secret; no new backend or native package is needed.
Photos and their base64 contents are not stored in planning documents.

An explicit capability list substitutes within a movement family, using confirmed
specific machines, attachments and space. Unknown custom exercises are omitted with a
visible explanation. Working sets are capped against the requested approximate time,
including warm-up and rest. All strength weights start blank, including on an unfamiliar
machine bearing the same exercise name. Cardio uses the existing logger convention:
`weight` contains minutes and `reps` contains distance; substitutions fill minutes and
leave distance blank. Cycling does not generate running kilometres. A technical circuit
uses the existing superset UI to move between its exercises.

Drafts are addressable from the journal, persist across reloads and do not count as
completed sessions. Future drafts can only start on their own day. Actual source credit
and training kind are copied through active/save/resume; a completed workout satisfies
one source session. An unfamiliar-equipment workout cannot overwrite its source routine,
restore omitted items on resume, or set future strength weights/records at the usual gym.
The live UI suppresses old-machine targets and automatic weight filling. Reported WOD
feedback updates existing actual load without double-counting it.

Validation includes TypeScript checks, planning regression tests, Android OTA export
and a mobile-sized web flow. Camera permission/hardware and a live Gemini image request
must additionally be checked on the actual phone with the user's key. The manual flow
works without a Gemini key. No native configuration or dependencies were changed.
