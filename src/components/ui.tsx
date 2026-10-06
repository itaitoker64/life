import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, spacing } from '../theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewProps['style'];
}) {
  const inner = padded ? { padding: spacing.lg, paddingBottom: spacing.xxl * 2 } : undefined;
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  color,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  color?: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
        <View>
          <Text style={font.h3}>{title}</Text>
          {subtitle ? <Text style={font.tiny}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={font.h1}>{children}</Text>
      {sub ? <Text style={font.small}>{sub}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={font.label}>{children}</Text>
      {right}
    </View>
  );
}

export function Row({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.row, style]} {...rest}>
      {children}
    </View>
  );
}

export function Button({
  title,
  variant = 'primary',
  loading,
  icon,
  size = 'md',
  style,
  ...rest
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.dangerSoft
        : variant === 'secondary'
          ? colors.primarySoft
          : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && { paddingVertical: 8, paddingHorizontal: 12 },
        { backgroundColor: bg, opacity: pressed || rest.disabled ? 0.6 : 1 },
        style as any,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row style={{ gap: spacing.sm }}>
          {icon}
          <Text style={{ color: fg, fontWeight: '700', fontSize: size === 'sm' ? 13 : 15 }}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  color = colors.primary,
  onPress,
}: {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? color : colors.track, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  suffix,
  style,
  ...rest
}: TextInputProps & { label?: string; suffix?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput style={[styles.input, style]} placeholderTextColor={colors.faint} {...rest} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({
  label,
  value,
  sub,
  color,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={font.label}>{label}</Text>
      <Text style={[big ? font.display : font.h2, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={font.tiny}>{sub}</Text> : null}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <Text style={font.small}>{text}</Text>
    </View>
  );
}

export function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: 4,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill },
  label: { ...font.small, marginBottom: 6, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.track,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  suffix: { ...font.small, marginLeft: 6 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card, ...shadow },
});
