/**
 * Design system for Cal AI app
 * Based on the Personalized Nutrition Goals feature design specifications
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

// Primary brand accent – deep green
const tintColorLight = '#2F9E44';
const tintColorDark = '#fff';

// Legacy Colors (for backward compatibility)
export const Colors = {
  light: {
    text: '#111827',
    background: '#F9FAFB',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Design System Colors
export const DesignColors = {
  // Primary / Accent (Mint)
  primary: '#2F9E44',
  primaryDark: '#238636',
  primaryLight: '#D3F9D8',
  primaryBg: '#ECFCE6',

  // Neutrals (Slate-ish)
  black: '#111827',
  white: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',

  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Macro Accents
  protein: '#F43F5E', // Rose
  proteinBg: '#FFF1F2',
  carbs: '#F59E0B', // Amber (used for contrast)
  carbsBg: '#FFFBEB',
  fat: '#3B82F6', // Blue
  fatBg: '#EFF6FF',

  // Legacy/Specific mappings for compatibility
  proteinRed: '#F43F5E',
  proteinRedBg: '#FFF1F2',
  carbsOrange: '#F59E0B',
  carbsOrangeBg: '#FFFBEB',
  fatBlue: '#3B82F6',
  fatBlueBg: '#EFF6FF',
  successGreen: '#10B981',
  successGreenBg: '#ECFDF5',
  errorRed: '#EF4444',
  errorRedBg: '#FEF2F2',
  errorRedDark: '#991B1B',
  errorRedBorder: '#FCA5A5',
  warningDark: '#D97706',
  successDark: '#059669',

  // Semantic
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  infoDark: '#1D4ED8',

  // Surfaces
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceHighlight: '#F1F5F9',
};

// Shadows
export const Shadows: Record<string, ViewStyle> = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 5,
  },
  sm: {
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
};

// Typography Styles
const baseFont: TextStyle = {
  fontFamily: 'Sora',
};

export const Typography: Record<string, TextStyle> = {
  // Headers
  h1: {
    ...baseFont,
    fontSize: 32,
    fontWeight: '700',
    color: DesignColors.textPrimary,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    ...baseFont,
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    ...baseFont,
    fontSize: 20,
    fontWeight: '600',
    color: DesignColors.textPrimary,
    lineHeight: 28,
  },

  // Legacy Typography
  title: {
    ...baseFont,
    fontSize: 28,
    fontWeight: '700',
    color: DesignColors.textPrimary,
  },
  subtitle: {
    ...baseFont,
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.textSecondary,
  },

  // Body
  body: {
    ...baseFont,
    fontSize: 16,
    fontWeight: '400',
    color: DesignColors.textSecondary,
    lineHeight: 24,
  },
  bodyBold: {
    ...baseFont,
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.textPrimary,
    lineHeight: 24,
  },
  bodySmall: {
    ...baseFont,
    fontSize: 14,
    fontWeight: '400',
    color: DesignColors.textSecondary,
    lineHeight: 20,
  },
  bodySmallBold: {
    ...baseFont,
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.textPrimary,
    lineHeight: 20,
  },

  // Utility
  caption: {
    ...baseFont,
    fontSize: 12,
    fontWeight: '500',
    color: DesignColors.gray500,
    lineHeight: 16,
  },
  label: {
    ...baseFont,
    fontSize: 13,
    fontWeight: '600',
    color: DesignColors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Display Numbers
  displayLarge: {
    ...baseFont,
    fontSize: 48,
    fontWeight: '800',
    color: DesignColors.black,
    letterSpacing: -1,
  },
  displayMedium: {
    ...baseFont,
    fontSize: 32,
    fontWeight: '700',
    color: DesignColors.black,
    letterSpacing: -0.5,
  },
};

// Spacing System
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

// Border Radius
export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,

  // Legacy
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  round: 28,
  circle: 60,
};

// Component Styles
export const ComponentStyles = {
  primaryButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: DesignColors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...Shadows.md,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: DesignColors.white,
  },
  secondaryButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: DesignColors.white,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: DesignColors.gray800,
  },
  card: {
    backgroundColor: DesignColors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: DesignColors.gray100,
    ...Shadows.sm,
  },
};

// Animation Durations
export const AnimationDurations = {
  fast: 200,
  normal: 300,
  slow: 500,

  // Legacy
  screenTransition: 300,
  buttonPress: 100,
  progressBarFill: 2000,
  circularProgress: 1500,
};

// Layout Constants
export const Layout = {
  horizontalPadding: 20,
  verticalPadding: 24,
  sectionGap: 32,
  cardBorderRadius: 24,
  buttonBorderRadius: 28,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Sora',
    serif: 'Georgia',
    mono: 'Menlo',
  },
  android: {
    sans: 'Sora',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: 'Sora, Inter, system-ui, sans-serif',
    serif: 'Georgia, serif',
    mono: 'monospace',
  },
});
