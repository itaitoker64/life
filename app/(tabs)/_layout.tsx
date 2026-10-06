import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { L, useLiftVersion } from '../../src/strength/store';
import { fmtClock } from '../../src/strength/utils';
import { elapsedSec } from '../../src/strength/workout';
import { colors, font } from '../../src/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Tabs
        tabBar={(props) => (
          <View>
            <ActiveWorkoutBar />
            <BottomTabBar {...props} />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.faint,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          // Room for Android's system navigation buttons (the app draws edge-to-edge).
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'היום', tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="train" options={{ title: 'אימונים', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="nutrition" options={{ title: 'תזונה', tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="add" options={{ href: null }} />
        <Tabs.Screen
          name="progress"
          options={{ title: 'התקדמות', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }}
        />
      </Tabs>

    </>
  );
}

/** Minimised live workout, above the tab bar (like Hevy / Lift's resume bar). */
function ActiveWorkoutBar() {
  useLiftVersion();
  const router = useRouter();
  const [, setTick] = useState(0);
  const a = L.active;
  useEffect(() => {
    if (!a) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [a]);
  if (!a) return null;
  const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
  const all = a.items.reduce((n, it) => n + it.sets.length, 0);
  const restLeft = a.rest ? Math.ceil((a.rest.endsAt - Date.now()) / 1000) : 0;
  return (
    <Pressable
      onPress={() => router.push('/strength/workout')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.elev2, paddingHorizontal: 14, paddingVertical: 9 }}
    >
      <Ionicons name="barbell" size={20} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
          {a.name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
          {done}/{all} סטים · {fmtClock(elapsedSec(a))}
          {restLeft > 0 ? ` · מנוחה ${fmtClock(restLeft)}` : ''}
        </Text>
      </View>
      <Text style={{ color: '#fff', fontWeight: '800' }}>חזרה</Text>
    </Pressable>
  );
}
