// Bottom sheet, action menu and toast — the overlays Lift built with UI.sheet / UI.menu / UI.toast.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, font, radius, spacing } from '../theme';

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            maxHeight: '88%',
            paddingBottom: insets.bottom,
          }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
          {title ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: 14, flexShrink: 1 }}>{children}</View>
          )}
          {footer ? <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface MenuItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
}

/** Action menu as a bottom sheet (Lift's ⋮ menus). */
export function Menu({
  visible,
  onClose,
  title,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: Array<MenuItem | null | false | undefined>;
}) {
  const list = items.filter(Boolean) as MenuItem[];
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {list.map((it, i) => (
        <Pressable
          key={i}
          onPress={() => {
            onClose();
            // Let the sheet close before the action opens another one.
            setTimeout(it.onPress, 220);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: 14,
            paddingHorizontal: 6,
            borderBottomWidth: i < list.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
            backgroundColor: pressed ? colors.elev2 : 'transparent',
            borderRadius: radius.sm,
          })}
        >
          {it.icon ? <Ionicons name={it.icon} size={20} color={it.danger ? colors.danger : colors.muted} /> : null}
          <Text style={[font.body, { color: it.danger ? colors.danger : colors.text, flex: 1 }]}>{it.label}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

// ---------------- toast ----------------

interface ToastState {
  msg: string | null;
  action?: { label: string; onPress: () => void };
  key: number;
}
const useToastStore = create<ToastState>(() => ({ msg: null, key: 0 }));
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string, opts: { ms?: number; action?: { label: string; onPress: () => void } } = {}) {
  if (toastTimer) clearTimeout(toastTimer);
  useToastStore.setState((s) => ({ msg, action: opts.action, key: s.key + 1 }));
  toastTimer = setTimeout(() => useToastStore.setState({ msg: null, action: undefined }), opts.ms ?? (opts.action ? 5000 : 2600));
}

export function ToastHost() {
  const { msg, action, key } = useToastStore();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: msg ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [msg, key, anim]);
  if (!msg) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + 90,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.elev2,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Text style={[font.body, { flex: 1, fontSize: 14 }]}>{msg}</Text>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              useToastStore.setState({ msg: null, action: undefined });
            }}
            hitSlop={8}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
