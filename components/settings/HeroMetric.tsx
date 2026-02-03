import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type HeroMetricProps = {
  label: string;
  value: number | null;
  unit: string;
  onPress: () => void;
};

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat('en-US').format(value);
  } catch {
    return String(value);
  }
}

export function HeroMetric({ label, value, unit, onPress }: HeroMetricProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const accessibilityLabel = useMemo(() => {
    const readableValue = typeof value === 'number' ? value : 'not set';
    return `${label}, ${readableValue} ${unit}, double tap to edit`;
  }, [label, unit, value]);

  const animateTo = (next: number) => {
    Animated.spring(scale, {
      toValue: next,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          /* no-op */
        });
        onPress();
      }}
      onPressIn={() => animateTo(0.98)}
      onPressOut={() => animateTo(1)}
      style={styles.pressable}>
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{typeof value === 'number' ? formatNumber(value) : '—'}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>

        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={18} color={DesignColors.iosSecondaryLabel} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    margin: 16,
  },
  container: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: DesignColors.iosSecondaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: DesignColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  value: {
    fontSize: 34,
    fontWeight: '800',
    color: DesignColors.iosLabel,
    letterSpacing: -0.5,
  },
  unit: {
    marginTop: 4,
    fontSize: 15,
    color: DesignColors.iosSecondaryLabel,
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
});
