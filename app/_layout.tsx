import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useApp } from '../src/state/store';
import { colors } from '../src/theme';

export default function RootLayout() {
  const { ready, profile, init } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    init().catch((e) => console.error('init failed', e));
  }, [init]);

  useEffect(() => {
    if (!ready || !profile) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile.onboarded && !inOnboarding) router.replace('/onboarding');
    if (profile.onboarded && inOnboarding) router.replace('/');
  }, [ready, profile, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
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
        <Stack.Screen name="weight" options={{ title: 'Weight Trend' }} />
        <Stack.Screen name="expenditure" options={{ title: 'Expenditure' }} />
        <Stack.Screen name="program-update" options={{ title: 'Program Update' }} />
        <Stack.Screen name="food/search" options={{ title: 'Add food' }} />
        <Stack.Screen name="food/scan" options={{ title: 'Scan barcode', headerShown: false }} />
        <Stack.Screen name="food/photo" options={{ title: 'AI photo' }} />
        <Stack.Screen name="food/new" options={{ title: 'Food' }} />
        <Stack.Screen name="food/[id]" options={{ title: 'Portion' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Edit entry' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
