import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Segmented } from '../../src/components/ui';
import { FoodLog } from '../../src/screens/FoodLog';
import { Strategy } from '../../src/screens/Strategy';
import { colors, spacing } from '../../src/theme';

export default function Nutrition() {
  const [tab, setTab] = useState<'log' | 'strategy'>('log');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Segmented
          options={[
            { value: 'log', label: 'יומן' },
            { value: 'strategy', label: 'תוכנית ויעדים' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 0 }}
        />
      </View>
      {tab === 'log' ? <FoodLog /> : <Strategy />}
    </SafeAreaView>
  );
}
