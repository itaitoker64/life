import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, I18nManager, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastHost } from '../src/components/sheet';
import { initRun, recalibrateIfStale, syncIfStale } from '../src/run/store';
import { useApp } from '../src/state/store';
import { initLift, useLift } from '../src/strength/store';
import { colors } from '../src/theme';

// Hebrew UI: the native config plugin forces RTL in builds; this covers Expo Go (applies after a restart).
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Rest-timer alerts show even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { ready, profile, init } = useApp();
  const liftReady = useLift((s) => s.ready);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      await init();
      await Promise.all([initLift(), initRun()]);
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rest', {
          name: 'טיימר מנוחה',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 120, 250],
          sound: 'default',
        }).catch(() => {});
      }
      await syncIfStale();
      await recalibrateIfStale();
    })().catch((e) => console.error('init failed', e));
  }, [init]);

  // Coming back to the app: pick up new runs.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncIfStale().then(recalibrateIfStale);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready || !profile) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile.onboarded && !inOnboarding) router.replace('/onboarding');
    if (profile.onboarded && inOnboarding) router.replace('/');
  }, [ready, profile, segments, router]);

  if (!ready || !liftReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'הגדרות' }} />
        <Stack.Screen name="weight" options={{ title: 'מגמת משקל' }} />
        <Stack.Screen name="expenditure" options={{ title: 'הוצאה קלורית' }} />
        <Stack.Screen name="program-update" options={{ title: 'עדכון תוכנית' }} />
        <Stack.Screen name="food/search" options={{ title: 'הוספת מזון' }} />
        <Stack.Screen name="food/scan" options={{ title: 'סריקת ברקוד', headerShown: false }} />
        <Stack.Screen name="food/photo" options={{ title: 'צילום AI' }} />
        <Stack.Screen name="food/new" options={{ title: 'מזון' }} />
        <Stack.Screen name="food/[id]" options={{ title: 'מנה' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'עריכת רישום' }} />
        <Stack.Screen name="strength/workout" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="strength/summary/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="strength/routine/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="strength/history" options={{ title: 'היסטוריית אימונים' }} />
        <Stack.Screen name="strength/history/[id]" options={{ title: 'אימון' }} />
        <Stack.Screen name="strength/exercises" options={{ title: 'תרגילים' }} />
        <Stack.Screen name="strength/exercise/[id]" options={{ title: 'תרגיל' }} />
        <Stack.Screen name="strength/coach" options={{ title: 'מאמן כוח' }} />
        <Stack.Screen name="strength/stats" options={{ title: 'סטטיסטיקת כוח' }} />
        <Stack.Screen name="run/history" options={{ title: 'היסטוריית ריצות' }} />
        <Stack.Screen name="run/goals" options={{ title: 'יעדים ומרוצים' }} />
        <Stack.Screen name="run/day/[date]" options={{ title: 'אימון ריצה' }} />
        <Stack.Screen name="backup" options={{ title: 'גיבוי ושחזור' }} />
      </Stack>
      <ToastHost />
    </GestureHandlerRootView>
  );
}
