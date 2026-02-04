import { Platform, TextStyle, ViewStyle } from 'react-native';

export const ThemeColors = {
  // Primary scale
  primary900: '#0F0F0F',
  primary800: '#1C1C1E',
  primary700: '#2C2C2E',
  primary100: '#F2F2F7',
  primary50: '#FFFFFF',

  // Accent colors (use sparingly)
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  info: '#007AFF',

  // Semantic
  calorieRing: ['#34C759', '#30D158'],
  protein: '#FF3B30',
  carbs: '#FF9500',
  fat: '#007AFF',

  // Backgrounds
  backgroundPrimary: '#F2F2F7',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#E5E5EA',

  // Text
  textPrimary: '#000000',
  textSecondary: '#3A3A3C',
  textTertiary: '#8E8E93',
  textInverse: '#FFFFFF',
};

const tintColorLight = ThemeColors.info;
const tintColorDark = ThemeColors.primary50;

// Legacy Colors (for backward compatibility)
export const Colors = {
  light: {
    text: ThemeColors.textPrimary,
    background: ThemeColors.backgroundPrimary,
    tint: tintColorLight,
    icon: ThemeColors.textTertiary,
    tabIconDefault: ThemeColors.textTertiary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: ThemeColors.textInverse,
    background: ThemeColors.primary900,
    tint: tintColorDark,
    icon: ThemeColors.primary100,
    tabIconDefault: ThemeColors.primary100,
    tabIconSelected: tintColorDark,
  },
};

// Design System Colors (mapped to new palette)
export const DesignColors = {
  ...ThemeColors,

  // App aliases
  primary: ThemeColors.info,
  primaryDark: ThemeColors.primary900,
  primaryLight: 'rgba(0, 122, 255, 0.12)',
  primaryBg: 'rgba(0, 122, 255, 0.08)',

  // Neutrals
  black: ThemeColors.primary900,
  white: ThemeColors.primary50,
  textPrimary: ThemeColors.textPrimary,
  textSecondary: ThemeColors.textSecondary,
  textTertiary: ThemeColors.textTertiary,

  gray50: ThemeColors.primary50,
  gray100: ThemeColors.primary100,
  gray200: ThemeColors.backgroundTertiary,
  gray300: '#D1D1D6',
  gray400: '#C7C7CC',
  gray500: ThemeColors.textTertiary,
  gray600: ThemeColors.textSecondary,
  gray700: ThemeColors.primary700,
  gray800: ThemeColors.primary800,
  gray900: ThemeColors.primary900,

  // Macro accents
  protein: ThemeColors.protein,
  proteinBg: 'rgba(255, 59, 48, 0.12)',
  carbs: ThemeColors.carbs,
  carbsBg: 'rgba(255, 149, 0, 0.12)',
  fat: ThemeColors.fat,
  fatBg: 'rgba(0, 122, 255, 0.12)',

  // Legacy mappings
  proteinRed: ThemeColors.protein,
  proteinRedBg: 'rgba(255, 59, 48, 0.12)',
  carbsOrange: ThemeColors.carbs,
  carbsOrangeBg: 'rgba(255, 149, 0, 0.12)',
  fatBlue: ThemeColors.fat,
  fatBlueBg: 'rgba(0, 122, 255, 0.12)',
  successGreen: ThemeColors.success,
  successGreenBg: 'rgba(52, 199, 89, 0.12)',
  errorRed: ThemeColors.danger,
  errorRedBg: 'rgba(255, 59, 48, 0.12)',
  errorRedDark: '#7A1F1A',
  errorRedBorder: 'rgba(255, 59, 48, 0.3)',
  warningDark: '#C76B00',
  successDark: '#248A3D',

  // Semantic
  success: ThemeColors.success,
  successBg: 'rgba(52, 199, 89, 0.12)',
  successBorder: 'rgba(52, 199, 89, 0.3)',
  warning: ThemeColors.warning,
  warningBg: 'rgba(255, 149, 0, 0.12)',
  warningBorder: 'rgba(255, 149, 0, 0.3)',
  error: ThemeColors.danger,
  errorBg: 'rgba(255, 59, 48, 0.12)',
  errorBorder: 'rgba(255, 59, 48, 0.3)',
  info: ThemeColors.info,
  infoBg: 'rgba(0, 122, 255, 0.12)',
  infoDark: '#0059B2',

  // Surfaces
  background: ThemeColors.backgroundPrimary,
  surface: ThemeColors.backgroundSecondary,
  surfaceHighlight: ThemeColors.backgroundTertiary,

  // iOS Settings-style tokens
  iosGroupedBackground: ThemeColors.backgroundPrimary,
  iosSecondaryBackground: ThemeColors.backgroundSecondary,
  iosLabel: ThemeColors.textPrimary,
  iosSecondaryLabel: ThemeColors.textTertiary,
  iosAccent: ThemeColors.info,
  iosDestructive: ThemeColors.danger,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
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
const FontFamilies = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const fontForWeight = (weight?: TextStyle['fontWeight']) => {
  switch (weight) {
    case '500':
    case 500:
      return FontFamilies.medium;
    case '600':
    case 600:
      return FontFamilies.semibold;
    case '700':
    case 700:
      return FontFamilies.bold;
    case '800':
    case 800:
    case '900':
    case 900:
      return FontFamilies.extrabold;
    default:
      return FontFamilies.regular;
  }
};

const baseFont: TextStyle = {
  fontFamily: FontFamilies.regular,
};

export const Typography: Record<string, TextStyle> = {
  // Display - Large stats
  displayLarge: {
    ...baseFont,
    fontSize: 48,
    lineHeight: 52,
    fontFamily: fontForWeight('900'),
    letterSpacing: -0.5,
    color: DesignColors.textPrimary,
  },
  displayMedium: {
    ...baseFont,
    fontSize: 36,
    lineHeight: 40,
    fontFamily: fontForWeight('800'),
    letterSpacing: -0.3,
    color: DesignColors.textPrimary,
  },

  // Headlines
  h1: {
    ...baseFont,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fontForWeight('700'),
    letterSpacing: -0.2,
    color: DesignColors.textPrimary,
  },
  h2: {
    ...baseFont,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontForWeight('700'),
    letterSpacing: -0.1,
    color: DesignColors.textPrimary,
  },
  h3: {
    ...baseFont,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontForWeight('600'),
    letterSpacing: 0,
    color: DesignColors.textPrimary,
  },

  // Body
  bodyLarge: {
    ...baseFont,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fontForWeight('400'),
    letterSpacing: -0.2,
    color: DesignColors.textSecondary,
  },
  bodyMedium: {
    ...baseFont,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontForWeight('400'),
    letterSpacing: -0.1,
    color: DesignColors.textSecondary,
  },
  bodySmall: {
    ...baseFont,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontForWeight('400'),
    letterSpacing: 0,
    color: DesignColors.textSecondary,
  },

  // Captions/Labels
  caption: {
    ...baseFont,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontForWeight('500'),
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    color: DesignColors.textTertiary,
  },
  label: {
    ...baseFont,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontForWeight('600'),
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: DesignColors.textSecondary,
  },

  // Legacy aliases
  title: {
    ...baseFont,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fontForWeight('700'),
    letterSpacing: -0.2,
    color: DesignColors.textPrimary,
  },
  subtitle: {
    ...baseFont,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fontForWeight('500'),
    letterSpacing: -0.2,
    color: DesignColors.textSecondary,
  },
  body: {
    ...baseFont,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fontForWeight('400'),
    letterSpacing: -0.2,
    color: DesignColors.textSecondary,
  },
  bodyBold: {
    ...baseFont,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontForWeight('600'),
    letterSpacing: -0.1,
    color: DesignColors.textPrimary,
  },
  bodySmallBold: {
    ...baseFont,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontForWeight('600'),
    letterSpacing: 0,
    color: DesignColors.textPrimary,
  },
};

// Spacing System
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 48,
  card: 20,
  section: 48,
};

// Border Radius
export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  card: 20,
  full: 9999,

  // Legacy
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 20,
  round: 28,
  circle: 60,
};

// Component Styles
export const ComponentStyles = {
  primaryButton: {
    borderRadius: BorderRadius.md,
    backgroundColor: DesignColors.info,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: fontForWeight('600'),
    color: DesignColors.textInverse,
  },
  secondaryButton: {
    borderRadius: BorderRadius.md,
    backgroundColor: DesignColors.surface,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: fontForWeight('600'),
    color: DesignColors.textPrimary,
  },
  card: {
    backgroundColor: DesignColors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.card,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
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
  cardBorderRadius: 20,
  buttonBorderRadius: 12,
};

export const Fonts = Platform.select({
  ios: {
    sans: FontFamilies.regular,
    serif: 'Georgia',
    mono: 'Menlo',
  },
  android: {
    sans: FontFamilies.regular,
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: FontFamilies.regular,
    serif: 'Georgia, serif',
    mono: 'monospace',
  },
});
