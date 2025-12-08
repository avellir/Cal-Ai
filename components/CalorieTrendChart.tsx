import React from 'react';

import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { DesignColors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

type CalorieTrendChartProps = {
  data: lineDataItem[];
  height?: number;
};

export function CalorieTrendChart({ data, height = 180 }: CalorieTrendChartProps) {
  return (
    <View style={styles.container}>
      <LineChart
        curved
        areaChart
        hideDataPoints
        data={data}
        height={height}
        color={DesignColors.primary}
        thickness={3}
        startFillColor={DesignColors.primary}
        endFillColor={DesignColors.primary}
        startOpacity={0.18}
        endOpacity={0.02}
        xAxisThickness={0}
        yAxisThickness={0}
        hideRules
        spacing={28}
        initialSpacing={12}
        yAxisTextStyle={{ display: 'none' }}
        xAxisLabelTextStyle={{ display: 'none' }}
        adjustToWidth
        isAnimated
        animateOnDataChange
        backgroundColor="transparent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    backgroundColor: DesignColors.white,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
});
