import { I18nManager, Platform } from 'react-native';

// Lift's dark palette (lift/css/styles.css). Older keys (card, track, black, …) map onto it so
// existing screens keep working.
export const colors = {
  bg: '#0c1016',
  card: '#161d27',
  elev2: '#202938',
  text: '#eef0f4',
  muted: '#9ba3b0',
  faint: '#929cad',
  border: '#2a3443',
  track: '#202938',
  black: '#8298ff',
  primary: '#8298ff',
  primaryPress: '#3a78ea',
  primarySoft: 'rgba(130, 152, 255, 0.12)',
  accent2: '#8b5cf6',
  success: '#22c55e',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  info: '#8298ff',
  pr: '#fbbf24',
  flame: '#ff8a3d',
  onAccent: '#ffffff',
  calories: '#8298ff',
  protein: '#ff7a5c',
  carbs: '#22c55e',
  fat: '#fbbf24',
  expenditure: '#ff8a3d',
  expenditureSoft: 'rgba(255, 138, 61, 0.22)',
  weight: '#a78bfa',
  weightSoft: 'rgba(167, 139, 250, 0.35)',
  run: '#2dd4bf',
  runSoft: 'rgba(45, 212, 191, 0.14)',
};

export const gradient = ['#425bc2', '#425bc2'] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 12, lg: 20, pill: 999 };
export const TAP = 44;

// Cards are separated by a hairline border rather than a drop shadow on the dark background.
export const shadow = {};

export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.8 },
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 12, color: colors.faint },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.faint, letterSpacing: 0.4 },
  screenTitle: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
};

// Chevrons that point "forward" in reading order: left in Hebrew.
export const isRTL = Platform.OS === 'web' || I18nManager.isRTL;
export const chevronForward = isRTL ? ('chevron-back' as const) : ('chevron-forward' as const);
export const chevronBack = isRTL ? ('chevron-forward' as const) : ('chevron-back' as const);
