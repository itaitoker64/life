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
      <View style={{ padding: spacing.lg, backgroundColor: colors.card }}>
        <StatHeader
          average={avg}
          difference={first != null && last != null ? last - first : null}
          unit="kcal"
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
            { label: 'Flux Range', color: colors.expenditure, kind: 'band' },
            { label: 'Expenditure', color: colors.expenditure, kind: 'line' },
            { label: 'Holding', color: colors.expenditure, kind: 'square' },
          ]}
        />

        <SectionHeading>Insights & Data</SectionHeading>
        <ChangesTable title="Expenditure Changes" changes={changes} color={colors.expenditure} unit="kcal" decimals={0} threshold={10} />

        <Card>
          <InfoBox
            value={`${profile.tdee}`}
            unit="kcal"
            title="Current Expenditure"
            desc="The latest estimate of your daily energy expenditure based on your weight trend and nutrition data."
          />
          <InfoBox
            value={weighedToday ? 'Updating' : 'Holding'}
            title="Current Strategy"
            desc={
              weighedToday
                ? `Today's weigh-in is in. The estimate uses ${series?.loggedDays ?? 0} fully logged days from the last three weeks.`
                : 'Log your weight for your next expenditure update.'
            }
          />
          <Text style={font.tiny}>
            Expenditure is re-estimated once per day from your smoothed weight trend and logged intake. Log at least 7 full days
            in a 3-week window for it to move.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
