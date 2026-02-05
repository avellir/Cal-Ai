import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Cal AI style minimal background
 * - Top section with subtle horizontal gradient
 * - Smooth fade to white for main content area
 */
export function AppBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#dbe1e1', '#ece8ec']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientTop}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%', // Extended lower for better contrast
  },
  gradientFade: {
    position: 'absolute',
    top: '35%', // Start fading lower down
    left: 0,
    right: 0,
    height: '20%', // Overlap height
  },
});
