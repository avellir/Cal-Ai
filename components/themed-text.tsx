import type { TextProps } from 'react-native';
import { Text, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type ThemedTextType =
  | 'default'
  | 'defaultSemiBold'
  | 'subtitle'
  | 'title'
  | 'link';

type Props = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: Props) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      {...rest}
      style={[
        styles[type],
        { color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 22,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Manrope_600SemiBold',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Manrope_500Medium',
  },
  title: {
    fontSize: 32,
    lineHeight: 34,
    fontFamily: 'Manrope_700Bold',
  },
  link: {
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'underline',
    fontFamily: 'Manrope_600SemiBold',
  },
});
