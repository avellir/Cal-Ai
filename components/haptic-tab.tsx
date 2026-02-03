import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import type { PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, style, children, ...restProps } = props;
  const { ref: _ignoredRef, ...rest } = restProps as typeof restProps & { ref?: unknown };

  return (
    <Pressable
      {...(rest as PressableProps)}
      style={(state) => [
        typeof style === 'function'
          ? (style as (state: PressableStateCallbackType) => StyleProp<ViewStyle>)(state)
          : (style as StyleProp<ViewStyle>),
        state.pressed ? { opacity: 0.9, transform: [{ scale: 0.98 }] } : null,
      ]}
      onPress={(event) => {
        Haptics.selectionAsync().catch(() => {
          /* no-op */
        });
        onPress?.(event);
      }}>
      {children}
    </Pressable>
  );
}
