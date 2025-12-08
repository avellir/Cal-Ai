import type { ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { DesignColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  children: ReactNode;
  headerHeight?: number;
  headerImage?: ReactNode;
  headerBackgroundColor?: {
    light: string;
    dark: string;
  };
};

export default function ParallaxScrollView({
  children,
  headerHeight = 280,
  headerImage,
  headerBackgroundColor = { light: DesignColors.gray50, dark: DesignColors.black },
}: Props) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme() ?? 'light';
  const { width } = useWindowDimensions();
  const backgroundColor =
    colorScheme === 'dark' ? headerBackgroundColor.dark : headerBackgroundColor.light;

  const headerStyles = useMemo(
    () => [
      styles.header,
      {
        height: headerHeight,
        backgroundColor,
      },
    ],
    [backgroundColor, headerHeight]
  );

  const translateY = scrollY.interpolate({
    inputRange: [-headerHeight, 0, headerHeight],
    outputRange: [-headerHeight / 2, 0, headerHeight * 0.75],
  });

  const scale = scrollY.interpolate({
    inputRange: [-headerHeight, 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp',
  });

  return (
    <Animated.ScrollView
      contentContainerStyle={styles.container}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}>
      <Animated.View style={headerStyles}>
        <Animated.View
          style={[
            styles.headerImageContainer,
            {
              transform: [
                { translateY },
                { scale },
              ],
              width,
            },
          ]}>
          {headerImage}
        </Animated.View>
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
});
