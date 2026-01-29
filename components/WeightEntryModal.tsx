import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
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

type WeightEntryModalProps = {
  visible: boolean;
  initialWeightKg?: number | null;
  onClose: () => void;
  onSave: (weightKg: number) => Promise<void> | void;
};

export function WeightEntryModal({
  visible,
  initialWeightKg,
  onClose,
  onSave,
}: WeightEntryModalProps) {
  const [weightText, setWeightText] = useState(
    typeof initialWeightKg === 'number' ? initialWeightKg.toString() : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setWeightText(typeof initialWeightKg === 'number' ? initialWeightKg.toString() : '');
    setIsSaving(false);
  }, [visible, initialWeightKg]);

  const prompt = useMemo(() => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `What is your weight today? (${today})`;
  }, []);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const validateWeightKg = (value: number) => {
    if (!Number.isFinite(value)) {
      return 'Please enter a valid number.';
    }
    if (value < 20 || value > 500) {
      return 'Please enter a weight between 20 and 500 kg.';
    }
    return null;
  };

  const handleSave = async () => {
    const value = parseFloat(weightText);
    const error = validateWeightKg(value);
    if (error) {
      Alert.alert('Invalid weight', error);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setIsSaving(false);
    }
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
              <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
                <Ionicons name="close" size={24} color={DesignColors.black} />
              </Pressable>
              <Text style={styles.title}>Current Weight</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={styles.prompt}>{prompt}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weightText}
                  onChangeText={setWeightText}
                  placeholder="e.g. 75"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                />
                <Text style={styles.helper}>
                  This adds a new entry to your weight log (it won’t overwrite past values).
                </Text>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Pressable
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button">
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save today’s weight'}</Text>
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
    fontWeight: '600',
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
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16,
  },
  prompt: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
    lineHeight: 22,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.gray600,
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
  helper: {
    fontSize: 13,
    color: DesignColors.gray500,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DesignColors.gray200,
    backgroundColor: DesignColors.white,
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.75,
  },
  saveButtonText: {
    color: DesignColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
