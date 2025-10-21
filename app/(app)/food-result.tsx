import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { getConfidenceMessage } from '@/services/foodAnalysis';

export default function FoodResultScreen() {
  const params = useLocalSearchParams<{
    foodName: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    servingSize: string;
    confidence: string;
    imageUri: string;
  }>();

  const session = useSessionStore((state) => state.session);
  const addMeal = useMealLogStore((state) => state.addMeal);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Session expired', 'Please sign in again to save your meal.');
      return;
    }

    const calories = Number.parseFloat(params.calories ?? '0') || 0;
    const protein = Number.parseFloat(params.protein ?? '0') || 0;
    const carbs = Number.parseFloat(params.carbs ?? '0') || 0;
    const fat = Number.parseFloat(params.fat ?? '0') || 0;
    const servingSize = params.servingSize?.trim() || null;

    setIsSaving(true);

    try {
      await addMeal(userId, {
        name: params.foodName?.trim() || 'Logged meal',
        calories,
        macros: { protein, carbs, fat },
        note: servingSize,
        servingSizeLabel: servingSize ?? undefined,
        imageUri: params.imageUri || null,
      });

      router.replace('/(app)/(tabs)');
    } catch (error) {
      console.error('Failed to save meal', error);
      Alert.alert('Unable to save meal', 'Please try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    router.back();
  };

  const confidence = parseInt(params.confidence || '0');
  const isHighConfidence = confidence >= 75;
  const isMediumConfidence = confidence >= 50 && confidence < 75;
  const confidenceMessage = getConfidenceMessage(confidence);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#11181C" />
        </Pressable>
        <Text style={styles.title}>Food Analysis</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {params.imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: params.imageUri }} style={styles.foodImage} />
          </View>
        )}

        <View style={styles.nameSection}>
          <Text style={styles.foodName}>{params.foodName}</Text>
          <Text style={styles.servingSize}>{params.servingSize}</Text>
        </View>

        <View style={[
          styles.confidenceBadge,
          isHighConfidence && styles.confidenceBadgeHigh,
          isMediumConfidence && styles.confidenceBadgeMedium,
          !isHighConfidence && !isMediumConfidence && styles.confidenceBadgeLow,
        ]}>
          <Feather
            name={isHighConfidence ? 'check-circle' : isMediumConfidence ? 'info' : 'alert-circle'}
            size={16}
            color={isHighConfidence ? '#059669' : isMediumConfidence ? '#D97706' : '#DC2626'}
          />
          <Text style={[
            styles.confidenceText,
            isHighConfidence && styles.confidenceTextHigh,
            isMediumConfidence && styles.confidenceTextMedium,
            !isHighConfidence && !isMediumConfidence && styles.confidenceTextLow,
          ]}>
            {confidence}% confidence
          </Text>
        </View>

        <View style={styles.caloriesCard}>
          <View style={styles.caloriesContent}>
            <Text style={styles.caloriesValue}>{params.calories}</Text>
            <Text style={styles.caloriesLabel}>Calories</Text>
          </View>
          <View style={styles.flameIcon}>
            <Feather name="zap" size={32} color="#FF7A00" />
          </View>
        </View>

        <View style={styles.macrosGrid}>
          <View style={styles.macroCard}>
            <View style={[styles.macroBadge, { backgroundColor: '#FFEFF1' }]}>
              <Ionicons name="fish" size={20} color="#FF7A7A" />
            </View>
            <Text style={styles.macroValue}>{params.protein}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>

          <View style={styles.macroCard}>
            <View style={[styles.macroBadge, { backgroundColor: '#EEF0FF' }]}>
              <Ionicons name="leaf" size={20} color="#7C8BFF" />
            </View>
            <Text style={styles.macroValue}>{params.carbs}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>

          <View style={styles.macroCard}>
            <View style={[styles.macroBadge, { backgroundColor: '#E6F7FF' }]}>
              <Ionicons name="water" size={20} color="#48C7F0" />
            </View>
            <Text style={styles.macroValue}>{params.fat}g</Text>
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
        </View>

        <View style={[
          styles.confidenceMessageBox,
          confidence < 40 && styles.confidenceMessageBoxLow,
          confidence >= 40 && confidence < 60 && styles.confidenceMessageBoxModerate,
          confidence >= 60 && confidence < 75 && styles.confidenceMessageBoxGood,
          confidence >= 75 && styles.confidenceMessageBoxHigh,
        ]}>
          <Feather 
            name={confidence < 40 ? 'alert-circle' : confidence < 60 ? 'alert-triangle' : confidence < 75 ? 'info' : 'check-circle'} 
            size={16} 
            color={confidence < 40 ? '#DC2626' : confidence < 60 ? '#D97706' : confidence < 75 ? '#2563EB' : '#059669'}
          />
          <Text style={[
            styles.confidenceMessageText,
            confidence < 40 && styles.confidenceMessageTextLow,
            confidence >= 40 && confidence < 60 && styles.confidenceMessageTextModerate,
            confidence >= 60 && confidence < 75 && styles.confidenceMessageTextGood,
            confidence >= 75 && styles.confidenceMessageTextHigh,
          ]}>
            {confidenceMessage}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.retakeButton} onPress={handleRetake}>
          <Feather name="camera" size={20} color="#6B7280" />
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && !isSaving && styles.saveButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.saveText}>Save to Log</Text>
              <Feather name="check" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  foodImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  nameSection: {
    gap: 4,
  },
  foodName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#11181C',
  },
  servingSize: {
    fontSize: 16,
    color: '#6B7280',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceBadgeHigh: {
    backgroundColor: '#D1FAE5',
  },
  confidenceBadgeMedium: {
    backgroundColor: '#FEF3C7',
  },
  confidenceBadgeLow: {
    backgroundColor: '#FEE2E2',
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceTextHigh: {
    color: '#059669',
  },
  confidenceTextMedium: {
    color: '#D97706',
  },
  confidenceTextLow: {
    color: '#DC2626',
  },
  caloriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  caloriesContent: {
    gap: 4,
  },
  caloriesValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#11181C',
  },
  caloriesLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  flameIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  macroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11181C',
  },
  macroLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  confidenceMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  confidenceMessageBoxLow: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  confidenceMessageBoxModerate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  confidenceMessageBoxGood: {
    backgroundColor: '#DBEAFE',
    borderColor: '#BFDBFE',
  },
  confidenceMessageBoxHigh: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  confidenceMessageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  confidenceMessageTextLow: {
    color: '#991B1B',
  },
  confidenceMessageTextModerate: {
    color: '#92400E',
  },
  confidenceMessageTextGood: {
    color: '#1E40AF',
  },
  confidenceMessageTextHigh: {
    color: '#065F46',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#11181C',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

