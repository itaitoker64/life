import React from 'react';
import { Text as RNText, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, font } from '../theme';

export function Ring({
  value,
  max,
  size = 160,
  stroke = 14,
  color = colors.calories,
  label,
  sub,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <RNText style={[font.h1, { fontSize: size > 140 ? 32 : 22 }]}>{label}</RNText>
      {sub ? <RNText style={font.tiny}>{sub}</RNText> : null}
    </View>
  );
}

export function MacroBar({
  label,
  value,
  max,
  color,
  unit = 'ג׳',
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const left = Math.round(max - value);
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <RNText style={[font.small, { fontWeight: '700', color: colors.text }]}>{label}</RNText>
        <RNText style={font.small}>
          <RNText style={{ color: colors.text, fontWeight: '700' }}>{Math.round(value)}</RNText> / {Math.round(max)} {unit}
          {'  '}
          <RNText style={{ color: left < 0 ? colors.danger : colors.faint }}>{left < 0 ? `${-left} מעל` : `נשארו ${left}`}</RNText>
        </RNText>
      </View>
      <View style={{ height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

export interface TrendChartPoint {
  trend: number | null;
  raw?: number | null;
  lo?: number | null;
  hi?: number | null;
}

// MacroFactor-style line chart: optional shaded band, faint raw line, bold trend line with markers,
// dashed gridlines with labels on the right, category labels below.
export function TrendChart({
  points,
  labels,
  width,
  height = 260,
  color,
  bandColor,
  rawColor,
  decimals = 0,
  compact = false,
  holdingLast = false,
}: {
  points: TrendChartPoint[];
  labels?: string[];
  width: number;
  height?: number;
  color: string;
  bandColor?: string;
  rawColor?: string;
  decimals?: number;
  compact?: boolean;
  holdingLast?: boolean;
}) {
  const pad = compact ? { l: 6, r: 6, t: 8, b: 8 } : { l: 4, r: 56, t: 16, b: 30 };
  const all = points.flatMap((p) => [p.trend, p.raw, p.lo, p.hi]).filter((v): v is number => v != null);
  if (all.length === 0) return null;
  let minY = Math.min(...all);
  let maxY = Math.max(...all);
  const span0 = maxY - minY;
  const padY = span0 < 1e-6 ? (decimals ? 0.5 : 25) : span0 * 0.15;
  minY -= padY;
  maxY += padY;
  const spanY = maxY - minY;
  const n = points.length;
  const plotW = width - pad.l - pad.r;
  const sx = (i: number) => (n <= 1 ? pad.l + plotW / 2 : pad.l + (i / (n - 1)) * plotW);
  const sy = (y: number) => pad.t + (1 - (y - minY) / spanY) * (height - pad.t - pad.b);

  const linePath = (key: 'trend' | 'raw') => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const bandPath = (() => {
    const idx = points.map((p, i) => (p.lo != null && p.hi != null ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return '';
    const top = idx.map((i, k) => `${k ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(points[i].hi!).toFixed(1)}`).join(' ');
    const bottom = [...idx].reverse().map((i) => `L${sx(i).toFixed(1)},${sy(points[i].lo!).toFixed(1)}`).join(' ');
    return `${top} ${bottom} Z`;
  })();

  const ticks = compact ? [] : [minY + spanY * 0.1, minY + spanY * 0.5, minY + spanY * 0.9].map((t) => niceTick(t, decimals));
  const showMarkers = points.length <= 16;
  const lastIdx = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].trend != null) return i;
    return -1;
  })();

  return (
    <Svg width={width} height={height}>
      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={pad.l} x2={width - pad.r + 4} y1={sy(t)} y2={sy(t)} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
          <SvgText x={width - pad.r + 10} y={sy(t) + 4} fontSize={13} fill={colors.muted}>
            {t.toFixed(decimals)}
          </SvgText>
        </React.Fragment>
      ))}
      {bandPath && bandColor ? <Path d={bandPath} fill={bandColor} opacity={0.9} /> : null}
      {rawColor ? <Path d={linePath('raw')} stroke={rawColor} strokeWidth={compact ? 1.5 : 2.5} fill="none" strokeLinejoin="round" /> : null}
      <Path d={linePath('trend')} stroke={color} strokeWidth={compact ? 2 : 2.5} fill="none" strokeLinejoin="round" />
      {showMarkers &&
        points.map((p, i) =>
          p.trend == null ? null : holdingLast && i === lastIdx ? (
            <Rect key={i} x={sx(i) - 4} y={sy(p.trend) - 4} width={8} height={8} fill={colors.card} stroke={color} strokeWidth={2} />
          ) : (
            <Circle key={i} cx={sx(i)} cy={sy(p.trend)} r={compact ? 3 : 4.5} fill={colors.card} stroke={color} strokeWidth={2} />
          ),
        )}
      {!compact &&
        labels?.map((l, i) =>
          l ? (
            <SvgText key={i} x={sx(i)} y={height - 8} fontSize={12} fill={colors.muted} textAnchor="middle">
              {l}
            </SvgText>
          ) : null,
        )}
    </Svg>
  );
}

function niceTick(v: number, decimals: number): number {
  const f = decimals ? Math.pow(10, decimals) * 2 : 1 / 50;
  return Math.round(v * f) / f;
}

export function Sparkline({ values, width = 84, height = 36, color }: { values: number[]; width?: number; height?: number; color: string }) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const sx = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const sy = (v: number) => 4 + (1 - (v - min) / span) * (height - 8);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${sx(values.length - 1).toFixed(1)},${height} L${sx(0).toFixed(1)},${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={color} opacity={0.25} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function BarChart({
  values,
  target,
  height = 140,
  width = 320,
  labels,
  color = colors.primary,
}: {
  values: number[];
  target?: number;
  height?: number;
  width?: number;
  labels?: string[];
  color?: string;
}) {
  const pad = { l: 8, r: 8, t: 8, b: labels ? 20 : 4 };
  const max = Math.max(1, ...values, target ?? 0) * 1.1;
  const n = values.length;
  const slot = (width - pad.l - pad.r) / n;
  const barW = Math.max(3, slot * 0.6);
  const sy = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  return (
    <Svg width={width} height={height}>
      {values.map((v, i) => (
        <Path
          key={i}
          d={`M${pad.l + i * slot + (slot - barW) / 2},${sy(0)} v${sy(v) - sy(0)} h${barW} V${sy(0)} z`}
          fill={target && v > target ? colors.warning : color}
          opacity={v === 0 ? 0.15 : 0.9}
        />
      ))}
      {target ? (
        <Line x1={pad.l} x2={width - pad.r} y1={sy(target)} y2={sy(target)} stroke={colors.text} strokeDasharray="4 4" />
      ) : null}
      {labels?.map((l, i) => (
        <SvgText key={i} x={pad.l + i * slot + slot / 2} y={height - 5} fontSize={10} fill={colors.muted} textAnchor="middle">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}
