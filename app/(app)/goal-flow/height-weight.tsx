import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import type { UnitSystem } from '@/lib/user-goals-types';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

export default function HeightWeightScreen() {
  const router = useRouter();
  const { setHeightWeight, unitSystem: savedUnitSystem, heightCm: savedHeightCm, weightKg: savedWeightKg } = useGoalFlow();
  
  // Initialize with saved values or defaults
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(savedUnitSystem || 'imperial');
  
  // Convert saved metric values to imperial for display
  const savedHeightFeet = savedHeightCm ? Math.floor(savedHeightCm / 30.48) : 5;
  const savedHeightInches = savedHeightCm ? Math.round((savedHeightCm % 30.48) / 2.54) : 8;
  const savedWeightLbs = savedWeightKg ? Math.round(savedWeightKg * 2.20462) : 150;
  
  // Imperial units
  const [heightFeet, setHeightFeet] = useState<number | undefined>(savedHeightFeet);
  const [heightInches, setHeightInches] = useState<number | undefined>(savedHeightInches);
  const [weightLbs, setWeightLbs] = useState<number | undefined>(savedWeightLbs);
  
  // Metric units
  const [heightCm, setHeightCm] = useState<number | undefined>(savedHeightCm || 170);
  const [weightKg, setWeightKg] = useState<number | undefined>(savedWeightKg || 70);

  // Validation state
  const [heightError, setHeightError] = useState<string>('');
  const [weightError, setWeightError] = useState<string>('');

  // Validation ranges
  const HEIGHT_MIN_CM = 100;
  const HEIGHT_MAX_CM = 250;
  const WEIGHT_MIN_KG = 30;
  const WEIGHT_MAX_KG = 300;

  // Convert ranges to imperial
  const HEIGHT_MIN_FT = Math.floor(HEIGHT_MIN_CM / 30.48);
  const HEIGHT_MAX_FT = Math.ceil(HEIGHT_MAX_CM / 30.48);
  const WEIGHT_MIN_LBS = Math.round(WEIGHT_MIN_KG * 2.20462);
  const WEIGHT_MAX_LBS = Math.round(WEIGHT_MAX_KG * 2.20462);

  const validateHeight = (heightInCm: number): string => {
    if (heightInCm < HEIGHT_MIN_CM) {
      return `Height must be at least ${HEIGHT_MIN_CM} cm (${HEIGHT_MIN_FT} ft)`;
    }
    if (heightInCm > HEIGHT_MAX_CM) {
      return `Height must be less than ${HEIGHT_MAX_CM} cm (${HEIGHT_MAX_FT} ft)`;
    }
    return '';
  };

  const validateWeight = (weightInKg: number): string => {
    if (weightInKg < WEIGHT_MIN_KG) {
      return `Weight must be at least ${WEIGHT_MIN_KG} kg (${WEIGHT_MIN_LBS} lbs)`;
    }
    if (weightInKg > WEIGHT_MAX_KG) {
      return `Weight must be less than ${WEIGHT_MAX_KG} kg (${WEIGHT_MAX_LBS} lbs)`;
    }
    return '';
  };

  const isValid = unitSystem === 'imperial'
    ? heightFeet !== undefined && heightInches !== undefined && weightLbs !== undefined
    : heightCm !== undefined && weightKg !== undefined;

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleButtonPressIn = () => {
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: AnimationDurations.buttonPress,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: AnimationDurations.buttonPress,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = () => {
    // Convert to metric for storage
    let finalHeightCm: number;
    let finalWeightKg: number;
    
    if (unitSystem === 'imperial') {
      // Convert imperial to metric
      finalHeightCm = (heightFeet! * 30.48) + (heightInches! * 2.54);
      finalWeightKg = weightLbs! / 2.20462;
    } else {
      finalHeightCm = heightCm!;
      finalWeightKg = weightKg!;
    }
    
    // Validate height
    const heightValidationError = validateHeight(finalHeightCm);
    if (heightValidationError) {
      setHeightError(heightValidationError);
      return;
    }
    setHeightError('');
    
    // Validate weight
    const weightValidationError = validateWeight(finalWeightKg);
    if (weightValidationError) {
      setWeightError(weightValidationError);
      return;
    }
    setWeightError('');
    
    // Save to context
    setHeightWeight(unitSystem, finalHeightCm, finalWeightKg);
    router.push('/goal-flow/birthdate');
  };

  return (
    <GoalFlowLayout currentStep={1} totalSteps={6}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Height & weight</Text>
        <Text style={styles.subtitle}>
          This helps us calculate your personalized nutrition goals
        </Text>

        {/* Unit System Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.toggleButtonLeft,
              unitSystem === 'imperial' && styles.toggleButtonActive,
            ]}
            onPress={() => setUnitSystem('imperial')}
          >
            <Text
              style={[
                styles.toggleText,
                unitSystem === 'imperial' && styles.toggleTextActive,
              ]}
            >
              Imperial
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.toggleButtonRight,
              unitSystem === 'metric' && styles.toggleButtonActive,
            ]}
            onPress={() => setUnitSystem('metric')}
          >
            <Text
              style={[
                styles.toggleText,
                unitSystem === 'metric' && styles.toggleTextActive,
              ]}
            >
              Metric
            </Text>
          </TouchableOpacity>
        </View>

        {/* Height Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Height</Text>
          {unitSystem === 'imperial' ? (
            <View style={styles.imperialRow}>
              <View style={styles.pickerContainer}>
                <TextInput
                  style={styles.pickerValue}
                  value={heightFeet?.toString() || ''}
                  onChangeText={(text: string) => {
                    const value = parseInt(text, 10);
                    setHeightFeet(isNaN(value) ? undefined : value);
                    setHeightError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={DesignColors.gray400}
                  maxLength={1}
                />
                <Text style={styles.pickerUnit}>ft</Text>
              </View>
              <View style={styles.pickerContainer}>
                <TextInput
                  style={styles.pickerValue}
                  value={heightInches?.toString() || ''}
                  onChangeText={(text: string) => {
                    const value = parseInt(text, 10);
                    setHeightInches(isNaN(value) ? undefined : value);
                    setHeightError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="8"
                  placeholderTextColor={DesignColors.gray400}
                  maxLength={2}
                />
                <Text style={styles.pickerUnit}>in</Text>
              </View>
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              <TextInput
                style={styles.pickerValue}
                value={heightCm?.toString() || ''}
                onChangeText={(text: string) => {
                  const value = parseInt(text, 10);
                  setHeightCm(isNaN(value) ? undefined : value);
                  setHeightError('');
                }}
                keyboardType="number-pad"
                placeholder="170"
                placeholderTextColor={DesignColors.gray400}
                maxLength={3}
              />
              <Text style={styles.pickerUnit}>cm</Text>
            </View>
          )}
          {heightError ? (
            <Text style={styles.errorText}>{heightError}</Text>
          ) : null}
        </View>

        {/* Weight Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Weight</Text>
          {unitSystem === 'imperial' ? (
            <View style={styles.pickerContainer}>
              <TextInput
                style={styles.pickerValue}
                value={weightLbs?.toString() || ''}
                onChangeText={(text: string) => {
                  const value = parseInt(text, 10);
                  setWeightLbs(isNaN(value) ? undefined : value);
                  setWeightError('');
                }}
                keyboardType="number-pad"
                placeholder="150"
                placeholderTextColor={DesignColors.gray400}
                maxLength={3}
              />
              <Text style={styles.pickerUnit}>lbs</Text>
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              <TextInput
                style={styles.pickerValue}
                value={weightKg?.toString() || ''}
                onChangeText={(text: string) => {
                  const value = parseInt(text, 10);
                  setWeightKg(isNaN(value) ? undefined : value);
                  setWeightError('');
                }}
                keyboardType="number-pad"
                placeholder="70"
                placeholderTextColor={DesignColors.gray400}
                maxLength={3}
              />
              <Text style={styles.pickerUnit}>kg</Text>
            </View>
          )}
          {weightError ? (
            <Text style={styles.errorText}>{weightError}</Text>
          ) : null}
        </View>

        {/* Continue Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            onPressIn={isValid ? handleButtonPressIn : undefined}
            onPressOut={isValid ? handleButtonPressOut : undefined}
            disabled={!isValid}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </GoalFlowLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    ...Typography.title,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.subtitle,
    fontWeight: '400',
    marginBottom: Spacing.xxxl,
    lineHeight: 22,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.xxxl,
    backgroundColor: DesignColors.gray100,
    borderRadius: BorderRadius.medium,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.small,
  },
  toggleButtonLeft: {
    marginRight: 2,
  },
  toggleButtonRight: {
    marginLeft: 2,
  },
  toggleButtonActive: {
    backgroundColor: DesignColors.black,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.gray500,
  },
  toggleTextActive: {
    color: DesignColors.white,
  },
  inputSection: {
    marginBottom: Layout.sectionGap,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
    marginBottom: Spacing.md,
  },
  imperialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.large,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    paddingVertical: Layout.horizontalPadding,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
    padding: 0,
    minWidth: 40,
  },
  pickerUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.gray500,
  },
  continueButton: {
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  continueButtonDisabled: {
    backgroundColor: DesignColors.gray300,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.white,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: DesignColors.errorRed,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
});
