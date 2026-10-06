import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, font } from '../theme';

const TICK = 12;

export function RulerPicker({
  min,
  max,
  step,
  value,
  onChange,
  decimals = 1,
  unit,
  majorEvery = 10,
  color = colors.primary,
  format,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
  unit?: string;
  majorEvery?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const count = Math.round((max - min) / step) + 1;
  const lastIdx = useRef(-1);
  const toValue = (idx: number) => +(min + idx * step).toFixed(decimals);
  const toIdx = (v: number) => Math.max(0, Math.min(count - 1, Math.round((v - min) / step)));

  useEffect(() => {
    if (!width) return;
    const idx = toIdx(value);
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      ref.current?.scrollTo({ x: idx * TICK, animated: false });
    }
  }, [value, width]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / TICK)));
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      Haptics.selectionAsync().catch(() => {});
      onChange(toValue(idx));
    }
  }

  const display = format ? format(value) : value.toFixed(decimals);

  return (
    // The ruler always scrolls left-to-right, also in the Hebrew UI.
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ alignItems: 'center', marginBottom: 6 }}>
        <Text style={[font.display, { color, fontSize: 34 }]}>
          {display}
          {unit ? <Text style={[font.body, { color: colors.muted, fontWeight: '600' }]}> {unit}</Text> : null}
        </Text>
      </View>
      <View style={{ height: 72, direction: 'ltr' }}>
        {width > 0 ? (
          <ScrollView
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{ paddingHorizontal: width / 2 - TICK / 2 }}
          >
            {Array.from({ length: count }, (_, i) => {
              const major = i % majorEvery === 0;
              return (
                <View key={i} style={{ width: TICK, alignItems: 'center', justifyContent: 'flex-end', height: 72, overflow: 'visible' }}>
                  {major ? (
                    <Text
                      style={[font.tiny, { position: 'absolute', top: 14, width: 48, left: TICK / 2 - 24, textAlign: 'center' }]}
                      numberOfLines={1}
                    >
                      {toValue(i).toFixed(decimals > 1 ? 1 : 0)}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      width: major ? 2 : 1,
                      height: major ? 28 : 14,
                      backgroundColor: major ? colors.muted : colors.border,
                      borderRadius: 1,
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 1.5,
            bottom: 0,
            width: 3,
            height: 40,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}
