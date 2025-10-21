import type { ViewProps } from 'react-native';
import { View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type Props = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...rest }: Props) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View {...rest} style={[{ backgroundColor }, style]} />;
}
