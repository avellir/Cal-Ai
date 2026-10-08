import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Platform, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';

import { DesignColors } from '@/constants/theme';

type SymbolName = Extract<ComponentProps<typeof SymbolView>['name'], string>;

type Props = {
  name: SymbolName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

const FALLBACK_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'house.fill': 'home',
  house: 'home-outline',
  'paperplane.fill': 'paper-plane',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'chart.bar.fill': 'stats-chart',
  'chart.bar': 'stats-chart-outline',
  'gearshape.fill': 'settings-sharp',
  gearshape: 'settings-outline',
};

export function IconSymbol({ name, size = 24, color = DesignColors.black, style }: Props) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name} tintColor={color} resizeMode="scaleAspectFit" style={[styles.symbol, { width: size, height: size }, style]} />;
  }

  const fallbackName = FALLBACK_ICON_MAP[name] ?? 'ellipse';

  return (
    <Ionicons
      name={fallbackName}
      size={size}
      color={color}
      style={style as StyleProp<TextStyle>}
    />
  );
}

const styles = StyleSheet.create({
  symbol: {
    aspectRatio: 1,
  },
});
