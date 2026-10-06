import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Menu } from '../../src/components/sheet';
import { useApp } from '../../src/state/store';
import { L, useLiftVersion } from '../../src/strength/store';
import { fmtClock } from '../../src/strength/utils';
import { elapsedSec, nextRoutine, startEmpty, startFromRoutine } from '../../src/strength/workout';
import { colors, font, gradient } from '../../src/theme';

export default function TabsLayout() {
  const router = useRouter();
  const { selectedDate } = useApp();
  const [menu, setMenu] = useState(false);
  useLiftVersion();

  const params = { date: selectedDate, meal: 'snack' };
  const next = nextRoutine();

  function startWorkout(fn: () => void) {
    if (L.active) {
      Alert.alert('יש אימון פעיל', 'להמשיך את האימון הנוכחי?', [
        { text: 'ביטול', style: 'cancel' },
        { text: 'להמשיך', onPress: () => router.push('/strength/workout') },
      ]);
      return;
    }
    fn();
    router.push('/strength/workout');
  }

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
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'היום', tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }} />
        <Tabs.Screen
          name="nutrition"
          options={{ title: 'תזונה', tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarButton: () => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
                <Pressable onPress={() => setMenu(true)} style={({ pressed }) => ({ marginTop: -18, opacity: pressed ? 0.85 : 1 })}>
                  <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.bg }}
                  >
                    <Ionicons name="add" size={32} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            ),
          }}
        />
        <Tabs.Screen name="train" options={{ title: 'אימון', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }} />
        <Tabs.Screen
          name="progress"
          options={{ title: 'התקדמות', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }}
        />
      </Tabs>

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title="הוספה מהירה"
        items={[
          { label: 'חיפוש מזון', icon: 'search', onPress: () => router.push({ pathname: '/food/search', params }) },
          { label: 'סריקת ברקוד', icon: 'barcode-outline', onPress: () => router.push({ pathname: '/food/scan', params }) },
          { label: 'צילום ארוחה (AI)', icon: 'sparkles-outline', onPress: () => router.push({ pathname: '/food/photo', params }) },
          { label: 'שקילה', icon: 'scale-outline', onPress: () => router.push('/weight') },
          L.active
            ? { label: 'חזרה לאימון הפעיל', icon: 'play', onPress: () => router.push('/strength/workout') }
            : next
              ? { label: `התחלת ${next.name}`, icon: 'play', onPress: () => startWorkout(() => startFromRoutine(next.id)) }
              : null,
          L.active ? null : { label: 'אימון ריק', icon: 'barbell-outline', onPress: () => startWorkout(startEmpty) },
        ]}
      />
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9 }}
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
