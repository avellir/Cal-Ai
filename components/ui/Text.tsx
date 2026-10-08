import { forwardRef } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';

import { Typography } from '@/constants/theme';

const defaultStyle = { fontFamily: Typography.body.fontFamily };

// Keep the app font explicit instead of mutating React Native's Text defaults.
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  return <NativeText {...props} ref={ref} style={[defaultStyle, style]} />;
});
