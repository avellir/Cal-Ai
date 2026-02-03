import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type ShimmerProps = {
  style?: ViewStyle;
};

export function Shimmer({ style }: ShimmerProps) {
  const [width, setWidth] = useState(0);
  const translateX = useSharedValue(-120);

  useEffect(() => {
    if (width === 0) return;
    translateX.value = withRepeat(
      withTiming(width + 120, { duration: 1200 }),
      -1,
      false
    );
  }, [width, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.base} />
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E5EA',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    flex: 1,
  },
});
