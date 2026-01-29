import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { DesignColors } from '@/constants/theme';
import type { ActivityLevel, Sex } from '@/lib/user-goals-types';

type SexActivityModalProps = {
  visible: boolean;
  sex: Sex;
  activityLevel: ActivityLevel;
  onClose: () => void;
  onSave: (next: { sex: Sex; activityLevel: ActivityLevel }) => Promise<void> | void;
};

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  title: string;
  subtitle: string;
}[] = [
  { value: 'sedentary', title: 'Sedentary', subtitle: 'Little or no exercise' },
  { value: 'light', title: 'Lightly active', subtitle: '1–3 days/week' },
  { value: 'moderate', title: 'Moderately active', subtitle: '3–5 days/week' },
  { value: 'active', title: 'Active', subtitle: '6–7 days/week' },
  { value: 'veryActive', title: 'Very active', subtitle: 'Hard training & physical job' },
];

export function SexActivityModal({
  visible,
  sex: initialSex,
  activityLevel: initialActivityLevel,
  onClose,
  onSave,
}: SexActivityModalProps) {
  const [sex, setSex] = useState<Sex>(initialSex);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initialActivityLevel);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSex(initialSex);
    setActivityLevel(initialActivityLevel);
    setIsSaving(false);
  }, [visible, initialSex, initialActivityLevel]);

  const title = useMemo(() => 'Personal details', []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ sex, activityLevel });
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
            <Ionicons name="close" size={24} color={DesignColors.black} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biological sex</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.choice, sex === 'male' && styles.choiceActive]}
                onPress={() => setSex('male')}
                activeOpacity={0.85}>
                <Text style={[styles.choiceText, sex === 'male' && styles.choiceTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, sex === 'female' && styles.choiceActive]}
                onPress={() => setSex('female')}
                activeOpacity={0.85}>
                <Text style={[styles.choiceText, sex === 'female' && styles.choiceTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity level</Text>
            <View style={styles.list}>
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = option.value === activityLevel;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.activityRow, selected && styles.activityRowActive]}
                    onPress={() => setActivityLevel(option.value)}
                    activeOpacity={0.85}>
                    <View style={styles.activityCopy}>
                      <Text style={styles.activityTitle}>{option.title}</Text>
                      <Text style={styles.activitySubtitle}>{option.subtitle}</Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={DesignColors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color={DesignColors.gray300} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button">
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
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
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.gray600,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  choice: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    backgroundColor: DesignColors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: {
    borderColor: DesignColors.primary,
    backgroundColor: DesignColors.primaryBg,
  },
  choiceText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
  },
  choiceTextActive: {
    color: DesignColors.primaryDark,
  },
  list: {
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    backgroundColor: DesignColors.white,
  },
  activityRowActive: {
    borderColor: DesignColors.primary,
    backgroundColor: DesignColors.primaryBg,
  },
  activityCopy: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
  },
  activitySubtitle: {
    fontSize: 13,
    color: DesignColors.gray500,
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
