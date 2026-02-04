import { useUserProfileStore } from '@/store/userProfileStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import { DesignColors } from '@/constants/theme';

type ProfileInputModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileInputModal({ visible, onClose }: ProfileInputModalProps) {
  const { profile, updateProfile } = useUserProfileStore();
  const [age, setAge] = useState(profile.age?.toString() || '');
  const [height, setHeight] = useState(profile.height?.toString() || '');
  const [weight, setWeight] = useState(profile.weight?.toString() || '');

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSave = () => {
    const ageNum = parseInt(age);
    const heightNum = parseInt(height);
    const weightNum = parseFloat(weight);

    if (!ageNum || ageNum < 1 || ageNum > 120) {
      Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 120');
      return;
    }

    if (!heightNum || heightNum < 50 || heightNum > 300) {
      Alert.alert('Invalid Height', 'Please enter a valid height between 50 and 300 cm');
      return;
    }

    if (!weightNum || weightNum < 20 || weightNum > 500) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 20 and 500 kg');
      return;
    }

    updateProfile({
      age: ageNum,
      height: heightNum,
      weight: weightNum,
    });

    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={DesignColors.black} />
              </Pressable>
              <Text style={styles.title}>Profile Information</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Ionicons name="calendar" size={20} color={DesignColors.gray500} />
                  <Text style={styles.inputLabel}>Age</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="Enter your age"
                  keyboardType="numeric"
                  maxLength={3}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Ionicons name="resize" size={20} color={DesignColors.gray500} />
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="Enter your height in cm"
                  keyboardType="numeric"
                  maxLength={3}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Ionicons name="fitness" size={20} color={DesignColors.gray500} />
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="Enter your weight in kg"
                  keyboardType="decimal-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                />
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignColors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.gray200,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: DesignColors.black,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 24,
  },
  inputGroup: {
    gap: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Manrope_500Medium',
    color: DesignColors.black,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DesignColors.black,
    backgroundColor: DesignColors.gray50,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: DesignColors.white,
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: DesignColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: DesignColors.white,
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
});
