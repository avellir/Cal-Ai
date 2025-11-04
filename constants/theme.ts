/**
 * Design system for Cal AI app
 * Based on the Personalized Nutrition Goals feature design specifications
 */

import { Platform, TextStyle } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// Legacy Colors (for backward compatibility)
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
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
  // Primary
  black: '#11181C',
  white: '#FFFFFF',
  
  // Grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  
  // Accent colors for macros
  proteinRed: '#FF7A7A',
  proteinRedBg: '#FFEFF1',
  carbsOrange: '#FFA726',
  carbsOrangeBg: '#FFF3E0',
  fatBlue: '#48C7F0',
  fatBlueBg: '#E6F7FF',
  
  // Progress/Success
  progressGradientStart: '#F8FAFC',
  progressGradientEnd: '#FFFFFF',
  successGreen: '#10B981',
  successGreenBg: '#D1FAE5',
  
  // Error
  errorRed: '#DC2626',
  errorRedBg: '#FEE2E2',
  errorRedBorder: '#FCA5A5',
  errorRedDark: '#991B1B',
};

// Typography Styles
export const Typography: Record<string, TextStyle> = {
  // Headers
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: DesignColors.black,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.gray500,
  },
  
  // Body
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: DesignColors.gray600,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
  },
  
  // Large numbers
  displayLarge: {
    fontSize: 42,
    fontWeight: '700',
    color: DesignColors.black,
  },
  displayMedium: {
    fontSize: 32,
    fontWeight: '700',
    color: DesignColors.black,
  },
  
  // Small text
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: DesignColors.gray500,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.gray600,
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
};

// Border Radius
export const BorderRadius = {
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
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.black,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: DesignColors.white,
  },
  progressBar: {
    height: 4,
    backgroundColor: DesignColors.gray200,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: DesignColors.black,
    borderRadius: 2,
  },
  circularProgress: {
    size: 120,
    strokeWidth: 12,
    backgroundColor: DesignColors.gray100,
    progressColor: DesignColors.black,
  },
  picker: {
    height: 200,
    backgroundColor: DesignColors.white,
    borderRadius: BorderRadius.large,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
};

// Animation Durations (in milliseconds)
export const AnimationDurations = {
  screenTransition: 300,
  buttonPress: 100,
  progressBarFill: 2000,
  circularProgress: 1500,
};

// Layout Constants
export const Layout = {
  horizontalPadding: 20,
  verticalPadding: 24,
  sectionGap: 24,
  cardBorderRadius: 24,
  buttonBorderRadius: 28,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
