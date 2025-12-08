import React from 'react';

import { CircularProgress } from '@/components/goal-flow/CircularProgress';
import { DesignColors } from '@/constants/theme';

type ProgressRingProps = {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
  showPercentage?: boolean;
};

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color = DesignColors.primary,
  backgroundColor = DesignColors.gray200,
  children,
  showPercentage = false,
}: ProgressRingProps) {
  return (
    <CircularProgress
      size={size}
      strokeWidth={strokeWidth}
      progress={value}
      color={color}
      backgroundColor={backgroundColor}
      showPercentage={showPercentage}>
      {children}
    </CircularProgress>
  );
}
