import { Platform } from 'react-native';

export const colors = {
  bg: '#F4F4F6',
  card: '#FFFFFF',
  text: '#111111',
  muted: '#6F6F76',
  faint: '#A5A5AD',
  border: '#E8E8EC',
  track: '#EEEEF1',
  black: '#111111',
  primary: '#111111',
  primarySoft: '#EDEDF0',
  success: '#3BA55D',
  successSoft: '#E3F5E8',
  warning: '#F5B52A',
  warningSoft: '#FFF4D6',
  danger: '#E5484D',
  dangerSoft: '#FDE7E8',
  info: '#4C7DF5',
  calories: '#4C7DF5',
  protein: '#F0684A',
  carbs: '#3BA55D',
  fat: '#F5B52A',
  expenditure: '#F5865F',
  expenditureSoft: '#FDE3DA',
  weight: '#8B7CF6',
  weightSoft: '#E6E1FD',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const shadow = Platform.select({
  ios: { shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 1 },
  default: {},
})!;

export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.8 },
  h1: { fontSize: 24, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  screenTitle: { fontSize: 26, fontWeight: '900' as const, color: '#8A8A90', letterSpacing: 1.5, textTransform: 'uppercase' as const },
};
