import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import { calculateAge } from '@/lib/user-goals-types';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BirthdateScreen() {
  const router = useRouter();
  const { setBirthdate, birthdate: savedBirthdate } = useGoalFlow();
  
  // Initialize with saved values or defaults
  const defaultDate = savedBirthdate || new Date(1990, 0, 1);
  const [month, setMonth] = useState(defaultDate.getMonth() + 1); // 1-12
  const [dayText, setDayText] = useState(defaultDate.getDate().toString());
  const [yearText, setYearText] = useState(defaultDate.getFullYear().toString());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Parse text values to numbers with defaults
  const day = parseInt(dayText, 10) || 1;
  const year = parseInt(yearText, 10) || 1990;

  const getCurrentAge = () => {
    const birthDate = new Date(year, month - 1, day);
    return calculateAge(birthDate);
  };

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

  const validateAge = (age: number): { valid: boolean; message?: string } => {
    const MIN_AGE = 13;
    const MAX_AGE = 120;
    
    if (age < MIN_AGE) {
      return {
        valid: false,
        message: `You must be at least ${MIN_AGE} years old to use this app.`,
      };
    }
    
    if (age > MAX_AGE) {
      return {
        valid: false,
        message: `Please enter a valid birthdate. Age cannot exceed ${MAX_AGE} years.`,
      };
    }
    
    return { valid: true };
  };

  const handleContinue = () => {
    const birthDate = new Date(year, month - 1, day);
    const age = calculateAge(birthDate);
    
    // Validate age
    const validation = validateAge(age);
    if (!validation.valid) {
      Alert.alert('Invalid Age', validation.message);
      return;
    }
    
    // Save to context
    setBirthdate(birthDate, age);
    router.push('/goal-flow/goal-selection');
  };

  return (
    <GoalFlowLayout
      currentStep={2}
      totalSteps={6}
      title="When were you born?"
      subtitle="We use your age to calculate accurate calorie needs">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Picker */}
        <View style={styles.datePickerContainer}>
          {/* Month Picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerLabel}>Month</Text>
            <TouchableOpacity 
              style={styles.pickerBox}
              onPress={() => setShowMonthPicker(true)}
            >
              <Text style={styles.pickerValue}>{MONTHS[month - 1]}</Text>
            </TouchableOpacity>
          </View>

          {/* Day Picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerLabel}>Day</Text>
            <View style={styles.pickerBox}>
              <TextInput
                style={styles.pickerValue}
                value={dayText}
                onChangeText={(text: string) => {
                  // Allow empty or numbers only
                  if (text === '' || /^\d+$/.test(text)) {
                    setDayText(text);
                  }
                }}
                onBlur={() => {
                  // Validate and set default if empty or invalid on blur
                  const value = parseInt(dayText, 10);
                  if (dayText === '' || isNaN(value) || value < 1 || value > 31) {
                    setDayText('1');
                  }
                }}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={DesignColors.gray400}
                maxLength={2}
              />
            </View>
          </View>

          {/* Year Picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerLabel}>Year</Text>
            <View style={styles.pickerBox}>
              <TextInput
                style={styles.pickerValue}
                value={yearText}
                onChangeText={(text: string) => {
                  // Allow empty or valid numbers
                  if (text === '' || /^\d{1,4}$/.test(text)) {
                    setYearText(text);
                  }
                }}
                onBlur={() => {
                  // Validate and set default if empty or invalid on blur
                  const value = parseInt(yearText, 10);
                  const currentYear = new Date().getFullYear();
                  if (yearText === '' || isNaN(value) || value < 1900 || value > currentYear) {
                    setYearText('1990');
                  }
                }}
                keyboardType="number-pad"
                placeholder="1990"
                placeholderTextColor={DesignColors.gray400}
                maxLength={4}
              />
            </View>
          </View>
        </View>

        {/* Month Picker Modal */}
        <Modal
          visible={showMonthPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMonthPicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <ScrollView style={styles.monthList}>
                {MONTHS.map((monthName, index) => (
                  <TouchableOpacity
                    key={monthName}
                    style={[
                      styles.monthOption,
                      month === index + 1 && styles.monthOptionSelected,
                    ]}
                    onPress={() => {
                      setMonth(index + 1);
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        month === index + 1 && styles.monthOptionTextSelected,
                      ]}
                    >
                      {monthName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Age Display */}
        <View style={styles.ageDisplay}>
          <Text style={styles.ageText}>Age: {getCurrentAge()} years</Text>
        </View>

        {/* Continue Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
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
  datePickerContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Layout.sectionGap,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  pickerBox: {
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.large,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    paddingVertical: Layout.horizontalPadding,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  pickerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignColors.black,
    textAlign: 'center',
    padding: 0,
  },
  ageDisplay: {
    backgroundColor: DesignColors.gray100,
    borderRadius: BorderRadius.medium,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: Spacing.xxxl,
  },
  ageText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
    textAlign: 'center',
  },
  continueButton: {
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.horizontalPadding,
  },
  modalContent: {
    backgroundColor: DesignColors.white,
    borderRadius: BorderRadius.large,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DesignColors.black,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Layout.horizontalPadding,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.gray200,
  },
  monthList: {
    maxHeight: 400,
  },
  monthOption: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Layout.horizontalPadding,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.gray100,
  },
  monthOptionSelected: {
    backgroundColor: DesignColors.gray100,
  },
  monthOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.black,
    textAlign: 'center',
  },
  monthOptionTextSelected: {
    fontWeight: '700',
    color: DesignColors.black,
  },
});
