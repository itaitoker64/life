# Life

אפליקציית אנדרואיד אחת לתזונה, אימוני כוח וריצה. ממשק בעברית, עיצוב כהה.

נבנתה מאיחוד של שלוש אפליקציות:
- **MacroFactor** (הבסיס): יומן אכילה, ברקוד, צילום AI, משקל, הוצאה קלורית אדפטיבית, צ׳ק-אין שבועי.
- **Lift**: רוטינות, אימון פעיל עם טיימר מנוחה, יעדי התקדמות, שיאים, מאמן כוח, דילואוד, סופרסטים, סטטיסטיקה.
- **Stride**: ריצות מ-Garmin דרך intervals.icu, VDOT, אזורי קצב, תוכנית שבועית מבוססת מחקר, מרוצים ותחזיות.

## איך זה בנוי

| חלק | איפה |
|---|---|
| ממשק | Expo 57 + React Native + expo-router, `app/` |
| תזונה ומשקל | SQLite (טבלאות MacroFactor), `src/db`, `src/lib` |
| כוח | `src/strength` — הלוגיקה של Lift, נשמרת כמסמכי JSON בטבלת `docs` |
| ריצה | `src/run` — המדע והמתכנן של Stride, רצים בטלפון; ריצות נמשכות מ-intervals.icu |
| AI | Gemini (`src/lib/gemini.ts`) עם מפתח של המשתמש, שמור ב-SecureStore |
| גיבוי | Supabase של המשתמש (`src/lib/cloud.ts`): טבלת `backups`, שורה אחת למשתמש, RLS |

אין שרת משלנו. כל המפתחות (Gemini, intervals.icu) מוזנים באפליקציה ונשמרים בטלפון בלבד.

## פקודות

```bash
npm install --legacy-peer-deps
npx tsc --noEmit                                         # בדיקת טיפוסים
npx eas-cli build -p android --profile preview           # APK חדש (כשמשנים חבילות נייטיב)
npx eas-cli update --channel production -m "תיאור"       # עדכון לטלפון בלי התקנה מחדש
```
