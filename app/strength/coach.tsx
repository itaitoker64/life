// Strength coach overview, ported from lift/js/views/coach.js.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { DeloadCard } from '../../src/components/strengthCards';
import { ExerciseThumb } from '../../src/components/strength';
import { Card, Row, Screen, SectionTitle } from '../../src/components/ui';
import { alternatives, deloadActive, summary } from '../../src/strength/coach';
import { L, exercise, exerciseName, useLiftVersion } from '../../src/strength/store';
import { relDay } from '../../src/strength/utils';
import { colors, font, spacing } from '../../src/theme';

export default function Coach() {
  useLiftVersion();
  const s = summary();
  const cal = (L.settings.calibrations || []).slice(-5).reverse();

  return (
    <Screen bottomInset={false}>
      <SectionTitle>התאוששות</SectionTitle>
      {deloadActive() || s.fatigue.suggest ? (
        <DeloadCard />
      ) : (
        <Card>
          <Text style={font.small}>
            אין סימני עייפות. דילואוד מוצע רק כשהביצועים יורדים בכמה תרגילים או כשרוב הסטים מגיעים לכשל — דילואודים מתוכננים לא הוסיפו שריר במחקרים.
          </Text>
        </Card>
      )}

      <SectionTitle>תקועים</SectionTitle>
      {!s.stalled.length ? (
        <Card>
          <Text style={font.small}>שום דבר לא תקוע — כל תרגיל עם מספיק היסטוריה שבר את השיא הקודם ב-3 האימונים האחרונים.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={[font.small, { marginBottom: 6 }]}>
            ה-1RM המשוער לא עלה ב-3 אימונים ויותר. באימון הבא, לחצו על שורת ⚠ בתרגיל לאפשרויות (להוסיף נפח, טווח חזרות חדש או החלפה).
          </Text>
          {s.stalled.map((x) => (
            <ExRow key={x.id} id={x.id} meta={`אין התקדמות ב-${x.stalledFor} אימונים`} />
          ))}
        </Card>
      )}

      {s.progressing.length ? (
        <>
          <SectionTitle>בהתקדמות</SectionTitle>
          <Card>
            {s.progressing.slice(0, 8).map((x) => (
              <ExRow key={x.id} id={x.id} meta="שיא חדש ב-3 האימונים האחרונים" right={`+${Math.round(x.change * 1000) / 10}%`} />
            ))}
          </Card>
        </>
      ) : null}

      {s.longRunning.length ? (
        <>
          <SectionTitle>כדאי להחליף</SectionTitle>
          <Card>
            <Text style={[font.small, { marginBottom: 6 }]}>
              בתוכנית 8+ שבועות וכבר לא מתקדמים. החלפת 1–2 מהם בתרגיל דומה נותנת גירוי חדש — כמה בכל פעם, לא הכול.
            </Text>
            {s.longRunning.map((x) => {
              const alt = alternatives(x.id, [], 1)[0];
              return <ExRow key={x.id} id={x.id} meta={`${x.weeks} שבועות${alt ? ` · נסו ${alt.lengthened ? '↗ ' : ''}${exerciseName(alt.id)}` : ''}`} />;
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>כיול מאמץ</SectionTitle>
      <Card>
        <Text style={font.small}>
          {s.failureDue.length
            ? `ממתינים: ${s.failureDue.map(exerciseName).join(', ')}. הם יקבלו "בדיקת כשל" אוטומטית באימון הבא.`
            : 'אין בדיקות כשל ממתינות. בערך כל 4 שבועות, תרגיל בטוח (מכונה, כבל, בידוד) מקבל אחת אוטומטית.'}
        </Text>
        {cal.map((c, i) => (
          <ExRow
            key={i}
            id={c.exId}
            meta={c.gap >= 2 ? `+${c.gap} חזרות מעבר לצפוי — לדחוף חזק יותר` : c.gap <= -2 ? `${c.gap} חזרות — הסטים כבר קשים מאוד` : `מדויק (${c.gap > 0 ? '+' : ''}${c.gap})`}
            right={relDay(c.t)}
          />
        ))}
      </Card>
    </Screen>
  );
}

function ExRow({ id, meta, right }: { id: string; meta: string; right?: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push({ pathname: '/strength/exercise/[id]', params: { id } })}>
      <Row style={{ gap: spacing.md, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }}>
        <ExerciseThumb ex={exercise(id)} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={font.body}>{exerciseName(id)}</Text>
          <Text style={font.tiny}>{meta}</Text>
        </View>
        {right ? <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12 }}>{right}</Text> : null}
      </Row>
    </Pressable>
  );
}
