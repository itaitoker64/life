import { syncAdaptations } from '../src/planning/runtime';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, I18nManager, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastHost } from '../src/components/sheet';
import { autoBackup, initCloud } from '../src/lib/cloud';
import { syncHealthWeights } from '../src/lib/health';
import { initRun, recalibrateIfStale, syncIfStale, useRun } from '../src/run/store';
import { initPlanning, usePlanning } from '../src/planning/store';
import { syncReminders } from '../src/planning/reminders';
import { validDate } from '../src/planning/model';
import { today } from '../src/lib/dates';
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
  const liftVersion = useLift((s) => s.version);
  const runVersion = useRun((s) => s.version);
  const runReady = useRun((s) => s.ready);
  const planning = usePlanning();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      await init();
      await Promise.all([initLift().then(initPlanning), initRun(), initCloud().catch(() => {})]);
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
      syncHealthWeights().then((n) => n && useApp.getState().bump()).catch(() => {});
    })().catch((e) => console.error('init failed', e));
  }, [init]);

  // Coming back to the app: pick up new runs.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        syncAdaptations().then(syncReminders).catch(e => console.warn('training sync failed', e));
        syncIfStale().then(recalibrateIfStale).catch(e => console.warn('run sync failed', e));
        syncHealthWeights().then((n) => n && useApp.getState().bump()).catch(() => {});
      }
      if (s === 'background') autoBackup();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (planning.ready && liftReady && runReady) syncAdaptations().then(syncReminders).catch(e => console.warn('training sync failed', e));
  }, [planning.data, planning.ready, liftReady, runReady, liftVersion, runVersion]);

  useEffect(() => {
    if (Platform.OS === 'web' || !ready || !liftReady || !planning.ready || !profile?.onboarded) return;
    function openReminder(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data;
      if (data?.screen === 'journal') router.push({ pathname: '/train', params: { tab: 'journal', ...(typeof data.date === 'string' && validDate(data.date) ? { date: data.date } : {}) } });
      else if (data?.screen === 'nutrition') {
        useApp.getState().setSelectedDate(today());
        router.push('/nutrition');
      }
      else return;
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    const last = Notifications.getLastNotificationResponse();
    if (last) openReminder(last);
    const sub = Notifications.addNotificationResponseReceivedListener(openReminder);
    return () => sub.remove();
  }, [ready, liftReady, planning.ready, profile?.onboarded, router]);

  useEffect(() => {
    if (!ready || !profile) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile.onboarded && !inOnboarding) router.replace('/onboarding');
    if (profile.onboarded && inOnboarding) router.replace('/');
  }, [ready, profile, segments, router]);

  if (!ready || !liftReady || !planning.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg, direction: 'rtl' }}>
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
        <Stack.Screen name="training/plan" options={{ title: 'תוכנית משולבת' }} />
        <Stack.Screen name="training/spontaneous" options={{ title: 'חדר כושר מזדמן' }} />
        <Stack.Screen name="training/crossfit" options={{ title: 'קרוספיט' }} />
        <Stack.Screen name="reminders" options={{ title: 'תזכורות' }} />
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
