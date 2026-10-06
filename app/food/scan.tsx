import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui';
import { getCachedLabel, getFoodByBarcode, insertFood } from '../../src/db/foods';
import { describeAiError, hasApiKey, readNutritionLabel } from '../../src/lib/ai';
import { lookupBarcode } from '../../src/lib/openfoodfacts';
import { colors, font, spacing } from '../../src/theme';

export default function Scan() {
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<string>('');
  const busy = useRef(false);
  const [paused, setPaused] = useState(false);

  async function onScanned(r: BarcodeScanningResult) {
    if (busy.current || paused) return;
    busy.current = true;
    setPaused(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const code = r.data.trim();
    try {
      setStatus('בודק במזונות שלך…');
      const local = await getFoodByBarcode(code);
      if (local) return open(local.id);

      setStatus('מחפש ב-Open Food Facts…');
      const off = await lookupBarcode(code);
      if (off) {
        const saved = await insertFood(off);
        return open(saved.id);
      }
      const cached = await getCachedLabel(code);
      if (cached) {
        return router.replace({ pathname: '/food/new', params: { barcode: code, date, meal, prefill: cached } });
      }
      notFound(code);
    } catch (e) {
      Alert.alert('החיפוש נכשל', e instanceof Error ? e.message : 'שגיאה לא ידועה', [
        { text: 'הזנה ידנית', onPress: () => manual(code) },
        { text: 'שוב', onPress: resume },
      ]);
    } finally {
      busy.current = false;
      setStatus('');
    }
  }

  function open(id: number) {
    router.replace({ pathname: '/food/[id]', params: { id: String(id), date, meal } });
  }

  function resume() {
    setPaused(false);
  }

  function manual(code: string) {
    router.replace({ pathname: '/food/new', params: { barcode: code, date, meal } });
  }

  function notFound(code: string) {
    Alert.alert(
      'המוצר לא נמצא',
      `הברקוד ${code} לא נמצא במזונות שלך וב-Open Food Facts. צלמו את טבלת הערכים התזונתיים והיא תיקרא אוטומטית.`,
      [
        { text: 'ביטול', style: 'cancel', onPress: resume },
        { text: 'הזנה ידנית', onPress: () => manual(code) },
        { text: 'צילום התווית', onPress: () => photographLabel(code) },
      ],
    );
  }

  async function photographLabel(code: string) {
    if (!(await hasApiKey())) {
      Alert.alert('צריך מפתח Gemini', 'קריאת תווית עם AI צריכה מפתח Gemini (חינמי). אפשר להוסיף אותו בהגדרות, או להזין ידנית.', [
        { text: 'הזנה ידנית', onPress: () => manual(code) },
        { text: 'להגדרות', onPress: () => router.replace('/settings') },
      ]);
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled) return resume();
    setStatus('קורא את התווית…');
    try {
      const label = await readNutritionLabel(res.assets[0], code);
      if (!label.readable) {
        Alert.alert('לא הצלחתי לקרוא את התווית', 'נסו שוב עם תאורה טובה יותר וכל הטבלה בתוך התמונה.', [
          { text: 'הזנה ידנית', onPress: () => manual(code) },
          { text: 'צילום חוזר', onPress: () => photographLabel(code) },
        ]);
        return;
      }
      router.replace({
        pathname: '/food/new',
        params: { barcode: code, date, meal, prefill: JSON.stringify(label) },
      });
    } catch (e) {
      Alert.alert('שגיאת AI', describeAiError(e), [
        { text: 'הזנה ידנית', onPress: () => manual(code) },
        { text: 'ביטול', onPress: resume },
      ]);
    } finally {
      setStatus('');
    }
  }

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={[font.body, { textAlign: 'center', marginBottom: spacing.lg }]}>
          צריך גישה למצלמה כדי לסרוק ברקודים.
        </Text>
        <Button title="אישור גישה למצלמה" onPress={requestPermission} />
        <Button title="חזרה" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
        onBarcodeScanned={paused ? undefined : onScanned}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <View style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.hint}>{status || 'כוונו אל הברקוד'}</Text>
          {status ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.sm }} /> : null}
        </View>
        <View style={{ padding: spacing.lg }}>
          {paused && !status ? <Button title="סריקה נוספת" onPress={resume} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 2 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: spacing.lg, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
});
