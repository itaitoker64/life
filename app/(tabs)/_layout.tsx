import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useApp } from '../../src/state/store';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const router = useRouter();
  const { selectedDate } = useApp();

  function openAdd() {
    const params = { date: selectedDate, meal: 'snack' };
    Alert.alert('Add', undefined, [
      { text: 'Search food', onPress: () => router.push({ pathname: '/food/search', params }) },
      { text: 'Scan barcode', onPress: () => router.push({ pathname: '/food/scan', params }) },
      { text: 'AI photo', onPress: () => router.push({ pathname: '/food/photo', params }) },
      { text: 'Log weight', onPress: () => router.push('/weight') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 84, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Food Log', tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
              <Pressable
                onPress={openAdd}
                style={({ pressed }) => ({
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: colors.black,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -14,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="add" size={34} color="#fff" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="strategy"
        options={{ title: 'Strategy', tabBarIcon: ({ color, size }) => <Ionicons name="git-network-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
