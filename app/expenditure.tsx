import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { TrendChart } from '../src/components/charts';
import { ChangesTable, InfoBox, Legend, RangeSelector, SectionHeading, StatHeader } from '../src/components/insights';
import { Card, Screen } from '../src/components/ui';
import { weightForDate } from '../src/db/weight';
import { expenditureSeries, type ExpenditureSeries } from '../src/lib/analytics';
import { today } from '../src/lib/dates';
import { RANGE_DAYS, axisLabels, firstLast, formatRange, mean, periodChanges, type RangeKey } from '../src/lib/series';
import { useApp } from '../src/state/store';
import { colors, font, spacing } from '../src/theme';

export default function Expenditure() {
  const { profile, version } = useApp();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('1W');
  const [series, setSeries] = useState<ExpenditureSeries | null>(null);
  const [all, setAll] = useState<ExpenditureSeries | null>(null);
  const [weighedToday, setWeighedToday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const tdee = profile?.tdee ?? 0;
      expenditureSeries(RANGE_DAYS[range], tdee).then(setSeries);
      expenditureSeries(null, tdee).then(setAll);
      weightForDate(today()).then((w) => setWeighedToday(!!w));
    }, [range, version, profile?.tdee]),
  );

  if (!profile) return null;
  const [first, last] = series ? firstLast(series.tdee) : [null, null];
  const avg = series ? mean(series.tdee) : null;
  const changes = all ? periodChanges(all.tdee, [3, 7, 14, 30, 90]) : [];
  const chartW = width - spacing.lg * 2;

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <StatHeader
          average={avg}
          difference={first != null && last != null ? last - first : null}
          unit="קק״ל"
          range={series && series.dates.length ? formatRange(series.dates[0], series.dates[series.dates.length - 1]) : ''}
          decimals={0}
        />
        {series && series.dates.length ? (
          <TrendChart
            width={chartW}
            height={300}
            color={colors.expenditure}
            bandColor={colors.expenditureSoft}
            holdingLast
            points={series.dates.map((_, i) => ({ trend: series.tdee[i], lo: series.lo[i], hi: series.hi[i] }))}
            labels={axisLabels(series.dates)}
          />
        ) : null}
        <View style={{ marginTop: spacing.md }}>
          <RangeSelector value={range} onChange={setRange} />
        </View>
      </View>

      <View style={{ padding: spacing.lg }}>
        <Legend
          items={[
            { label: 'טווח תנודה', color: colors.expenditure, kind: 'band' },
            { label: 'הוצאה', color: colors.expenditure, kind: 'line' },
            { label: 'ממתין', color: colors.expenditure, kind: 'square' },
          ]}
        />

        <SectionHeading>תובנות ונתונים</SectionHeading>
        <ChangesTable title="שינויים בהוצאה" changes={changes} color={colors.expenditure} unit="קק״ל" decimals={0} threshold={10} />

        <Card>
          <InfoBox
            value={`${profile.tdee}`}
            unit="קק״ל"
            title="הוצאה נוכחית"
            desc="ההערכה העדכנית להוצאה הקלורית היומית שלך, לפי מגמת המשקל ונתוני התזונה."
          />
          <InfoBox
            value={weighedToday ? 'מתעדכן' : 'ממתין'}
            title="מצב נוכחי"
            desc={
              weighedToday
                ? `השקילה של היום נרשמה. ההערכה מבוססת על ${series?.loggedDays ?? 0} ימים מלאים מתוך שלושת השבועות האחרונים.`
                : 'רשמו משקל כדי לקבל עדכון להוצאה.'
            }
          />
          <Text style={font.tiny}>
            ההוצאה מוערכת מחדש פעם ביום ממגמת המשקל המוחלקת ומהאכילה הרשומה. כדי שתזוז צריך לפחות 7 ימים מלאים בחלון של 3
            שבועות.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
