import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAP, chevronForward, colors, font, gradient, radius, spacing } from '../theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  bottomInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewProps['style'];
  bottomInset?: boolean;
}) {
  const inner = padded ? { padding: spacing.lg, paddingBottom: spacing.xxl * 2 } : undefined;
  return (
    <SafeAreaView style={[styles.screen, style]} edges={bottomInset ? ['top', 'left', 'right'] : ['left', 'right']}>
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
        <View style={{ flex: 1 }}>
          <Text style={font.h3}>{title}</Text>
          {subtitle ? <Text style={font.tiny}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Title({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={font.h1}>{children}</Text>
        {sub ? <Text style={[font.small, { marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      {right}
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'good';
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const fg =
    variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : variant === 'good' ? '#05240f' : colors.text;
  const bg =
    variant === 'secondary' ? colors.elev2 : variant === 'good' ? colors.success : variant === 'danger' ? colors.dangerSoft : 'transparent';
  const border = variant === 'ghost' || variant === 'primary' ? 'transparent' : variant === 'danger' ? 'rgba(239,68,68,0.4)' : colors.border;
  // A press whose handler returns a Promise blocks further presses until it settles, so a quick
  // double tap can never save twice (state updates alone are too slow to stop the second tap).
  const busyRef = useRef(false);
  const [running, setRunning] = useState(false);
  const busy = !!loading || running;
  const disabled = !!rest.disabled || busy;
  function handlePress(e: GestureResponderEvent) {
    if (busyRef.current || disabled) return;
    const result: unknown = rest.onPress?.(e);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      busyRef.current = true;
      setRunning(true);
      (result as Promise<unknown>).finally(() => {
        busyRef.current = false;
        setRunning(false);
      });
    }
  }
  const content = busy ? (
    <ActivityIndicator color={fg} />
  ) : (
    <Row style={{ gap: spacing.sm }}>
      {icon}
      <Text style={{ color: fg, fontWeight: '700', fontSize: size === 'sm' ? 13 : 15 }}>{title}</Text>
    </Row>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: bg, borderColor: border, opacity: rest.disabled ? 0.5 : pressed ? 0.85 : 1 },
        style as any,
      ]}
      {...rest}
      disabled={disabled}
      onPress={handlePress}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size === 'sm' ? radius.sm : radius.md }]}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color = colors.text,
  size = 22,
  bg,
  disabled,
  accessibilityLabel,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  bg?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (name === 'settings-outline' ? 'הגדרות' : name)}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        width: TAP,
        height: TAP,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.elev2 : bg ?? 'transparent',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Ionicons name={name} size={size} color={color} />
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
        {
          backgroundColor: active ? `${color}24` : colors.elev2,
          borderColor: active ? color : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '600', fontSize: 13 }}>{label}</Text>
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
  style,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  style?: ViewProps['style'];
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
              {o.label}
            </Text>
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

export function ListRow({
  icon,
  iconColor = colors.text,
  title,
  sub,
  right,
  onPress,
  onLongPress,
  last,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 13,
        paddingHorizontal: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.elev2 : 'transparent',
      })}
    >
      {icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elev2, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={font.h3} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={font.small} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name={chevronForward} size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Pill({ text, color = colors.muted, bg = colors.elev2 }: { text: string; color?: string; bg?: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 11, color, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <Text style={[font.small, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export function Divider({ my = spacing.md }: { my?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: my }} />;
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
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: spacing.md,
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
    minHeight: TAP,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonSm: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.sm },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1 },
  label: { ...font.small, marginBottom: 6, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elev2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: TAP,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.text },
  suffix: { ...font.small, marginStart: 6 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.elev2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: { flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card },
});
