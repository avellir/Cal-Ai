import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Droplet, Fish, Leaf } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroStatCard } from '@/components/MacroStatCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DesignColors, Spacing, Typography } from '@/constants/theme';
import { useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { getConfidenceMessage } from '@/services/foodAnalysis';
import { useUserGoalsStore } from '@/store/userGoalsStore';

type IngredientData = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  wasAdjusted?: boolean;
  adjustmentReason?: string;
};

type MicronutrientData = {
  saturatedFat?: number;
  vitaminA?: number;
  vitaminC?: number;
  calcium?: number;
  iron?: number;
};

// Portion presets for quick scaling
const PORTION_PRESETS = [
  { label: '½', multiplier: 0.5 },
  { label: '1×', multiplier: 1 },
  { label: '1½', multiplier: 1.5 },
  { label: '2×', multiplier: 2 },
];

// Custom Slider component
function CustomSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
}: {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
}) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderRef = useRef<View>(null);

  const percentage = (value - minimumValue) / (maximumValue - minimumValue);

  const handleLayout = (event: LayoutChangeEvent) => {
    setSliderWidth(event.nativeEvent.layout.width);
  };

  const calculateValue = (locationX: number) => {
    const clampedX = Math.max(0, Math.min(locationX, sliderWidth));
    const rawValue = minimumValue + (clampedX / sliderWidth) * (maximumValue - minimumValue);
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const newValue = calculateValue(evt.nativeEvent.locationX);
        onValueChange(Number(newValue.toFixed(1)));
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const startX = percentage * sliderWidth;
        const newX = startX + gestureState.dx;
        const newValue = calculateValue(newX);
        onValueChange(Number(newValue.toFixed(1)));
      },
    })
  ).current;

  return (
    <View
      ref={sliderRef}
      style={sliderStyles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${percentage * 100}%` }]} />
      </View>
      <View style={[sliderStyles.thumb, { left: `${percentage * 100}%` }]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    backgroundColor: DesignColors.gray300,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: DesignColors.primary,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DesignColors.primary,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

// Micronutrient row component
function MicronutrientRow({
  label,
  value,
  unit,
  dailyValue,
  icon
}: {
  label: string;
  value: number;
  unit: string;
  dailyValue?: number;
  icon: string;
}) {
  const percentage = dailyValue ? Math.round((value / dailyValue) * 100) : null;
  const isHigh = percentage !== null && percentage > 20;

  return (
    <View style={styles.microRow}>
      <View style={styles.microLeft}>
        <MaterialCommunityIcons name={icon as any} size={16} color={DesignColors.gray500} />
        <Text style={styles.microLabel}>{label}</Text>
      </View>
      <View style={styles.microRight}>
        <Text style={styles.microValue}>{Math.round(value)}{unit}</Text>
        {percentage !== null && (
          <View style={[styles.microDvBadge, isHigh ? styles.microDvBadgeHigh : undefined]}>
            <Text style={[styles.microDvText, isHigh ? styles.microDvTextHigh : undefined]}>
              {percentage}% DV
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

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
    ingredientsData?: string;
    adjustments?: string;
    warnings?: string;
    micronutrients?: string;
  }>();

  const session = useSessionStore((state) => state.session);
  const addMeal = useMealLogStore((state) => state.addMeal);
  const getDailyTargets = useUserGoalsStore((state) => state.getDailyTargets);
  const dailyTargets = getDailyTargets();
  const [isSaving, setIsSaving] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showMicros, setShowMicros] = useState(false);
  const [portionMultiplier, setPortionMultiplier] = useState(1);

  // Parse data
  const ingredients: IngredientData[] = params.ingredientsData
    ? JSON.parse(params.ingredientsData)
    : [];

  const adjustments: string[] = params.adjustments
    ? JSON.parse(params.adjustments)
    : [];

  const warnings: string[] = params.warnings
    ? JSON.parse(params.warnings)
    : [];

const micronutrients: MicronutrientData = useMemo(() => (
  params.micronutrients ? JSON.parse(params.micronutrients) : {}
), [params.micronutrients]);

  const confidence = parseInt(params.confidence || '0');
  const baseCalories = Number.parseFloat(params.calories ?? '0') || 0;
  const baseProtein = Number.parseFloat(params.protein ?? '0') || 0;
  const baseCarbs = Number.parseFloat(params.carbs ?? '0') || 0;
  const baseFat = Number.parseFloat(params.fat ?? '0') || 0;

  // Scaled values based on portion multiplier
  const scaled = useMemo(() => ({
    calories: Math.round(baseCalories * portionMultiplier),
    protein: baseProtein * portionMultiplier,
    carbs: baseCarbs * portionMultiplier,
    fat: baseFat * portionMultiplier,
    saturatedFat: (micronutrients.saturatedFat || 0) * portionMultiplier,
  }), [portionMultiplier, baseCalories, baseProtein, baseCarbs, baseFat, micronutrients]);

  // Calculate macro percentages
  const totalMacroCalories = (scaled.protein * 4) + (scaled.carbs * 4) + (scaled.fat * 9);
  const macroPercentages = useMemo(() => ({
    protein: totalMacroCalories > 0 ? Math.round((scaled.protein * 4 / totalMacroCalories) * 100) : 0,
    carbs: totalMacroCalories > 0 ? Math.round((scaled.carbs * 4 / totalMacroCalories) * 100) : 0,
    fat: totalMacroCalories > 0 ? Math.round((scaled.fat * 9 / totalMacroCalories) * 100) : 0,
  }), [scaled, totalMacroCalories]);

  const macroCards = [
    {
      key: 'protein' as const,
      label: 'Protein',
      value: scaled.protein,
      percent: macroPercentages.protein,
      color: DesignColors.protein,
      Icon: Fish,
    },
    {
      key: 'carbs' as const,
      label: 'Carbs',
      value: scaled.carbs,
      percent: macroPercentages.carbs,
      color: DesignColors.carbs,
      Icon: Leaf,
    },
    {
      key: 'fat' as const,
      label: 'Fat',
      value: scaled.fat,
      percent: macroPercentages.fat,
      color: DesignColors.fat,
      Icon: Droplet,
    },
  ];

  const hasMicronutrients = scaled.saturatedFat > 0;
  const hasAdjustedIngredients = ingredients.some(ing => ing.wasAdjusted);
  const confidenceMessage = getConfidenceMessage(confidence);

  const handleSave = async () => {
    if (isSaving) return;

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Session expired', 'Please sign in again to save your meal.');
      return;
    }

    setIsSaving(true);

    try {
      await addMeal(userId, {
        name: params.foodName?.trim() || 'Logged meal',
        calories: scaled.calories,
        macros: {
          protein: Math.round(scaled.protein),
          carbs: Math.round(scaled.carbs),
          fat: Math.round(scaled.fat)
        },
        note: portionMultiplier !== 1
          ? `${params.servingSize} (${portionMultiplier}×)`
          : params.servingSize || null,
        servingSizeLabel: params.servingSize ?? undefined,
        quantity: portionMultiplier,
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}>
          <Feather name="arrow-left" size={24} color={DesignColors.black} />
        </Pressable>
        <Text style={styles.title}>Food Analysis</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>

        {/* Food Image */}
        {params.imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: params.imageUri }} style={styles.foodImage} />
            <View style={styles.imageOverlay}>
              <Badge
                label={`Confidence ${confidence}%`}
                tone={confidence >= 75 ? 'success' : confidence >= 50 ? 'info' : 'warning'}
              />
            </View>
          </View>
        )}

        {/* Food Name & Serving */}
        <View style={styles.nameSection}>
          <Text style={styles.foodName}>{params.foodName}</Text>
          <Text style={styles.servingSize}>{params.servingSize}</Text>
        </View>

        {/* Hero calories */}
        <View style={styles.heroCalories}>
          <Text style={styles.overline}>Total</Text>
          <Text style={styles.caloriesValue}>{scaled.calories}</Text>
          <Text style={styles.caloriesLabel}>Calories</Text>
          {portionMultiplier !== 1 && (
            <Text style={styles.caloriesOriginal}>
              Base: {baseCalories} cal
            </Text>
          )}
        </View>

        {/* Portion + macros + calories stack */}
        <Card style={styles.stackCard} elevation="md">
          <Text style={styles.sectionTitle}>Portion & macros</Text>
          
          {/* Grouped portion controls */}
          <View style={styles.portionControlGroup}>
            <View style={styles.portionButtons}>
              {PORTION_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  style={({ pressed }) => [
                    styles.portionButton,
                    portionMultiplier === preset.multiplier && styles.portionButtonActive,
                    pressed && styles.portionButtonPressed,
                  ]}
                  onPress={() => setPortionMultiplier(preset.multiplier)}>
                  {({ pressed }) => (
                    <Text style={[
                      styles.portionButtonText,
                      portionMultiplier === preset.multiplier && styles.portionButtonTextActive,
                      pressed && !portionMultiplier && styles.portionButtonTextPressed,
                    ]}>
                      {preset.label}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Fine-tune</Text>
                <Text style={styles.sliderValue}>{portionMultiplier.toFixed(1)}×</Text>
              </View>
              <CustomSlider
                minimumValue={0.5}
                maximumValue={2}
                step={0.1}
                value={portionMultiplier}
                onValueChange={(value: number) => setPortionMultiplier(value)}
              />
            </View>
          </View>

          <View style={styles.macrosGrid}>
            {macroCards.map((macro) => (
              <MacroStatCard
                key={macro.key}
                label={macro.label}
                value={macro.value}
                percent={macro.percent}
                color={macro.color}
                Icon={macro.Icon}
              />
            ))}
          </View>

          {/* Confidence/Warning Banners - grouped under macros */}
          <View style={styles.confidenceWarningGroup}>
            {/* Confidence Message */}
            <View style={[
              styles.confidenceBanner,
              confidence >= 75 && styles.confidenceBannerHigh,
              confidence >= 50 && confidence < 75 && styles.confidenceBannerMedium,
              confidence < 50 && styles.confidenceBannerLow,
            ]}>
              <Feather
                name={confidence >= 75 ? 'check-circle' : confidence >= 50 ? 'info' : 'alert-circle'}
                size={16}
                color={confidence >= 75 ? DesignColors.successDark : confidence >= 50 ? DesignColors.warningDark : DesignColors.error}
              />
              <Text style={[
                styles.confidenceText,
                confidence >= 75 && styles.confidenceTextHigh,
                confidence >= 50 && confidence < 75 && styles.confidenceTextMedium,
                confidence < 50 && styles.confidenceTextLow,
              ]}>
                {confidenceMessage}
              </Text>
            </View>

            {/* Warnings */}
            {warnings.length > 0 && (
              <View style={styles.warningBanner}>
                <View style={styles.warningHeader}>
                  <Feather name="alert-triangle" size={16} color={DesignColors.warningDark} />
                  <Text style={styles.warningTitle}>Important Notes</Text>
                </View>
                {warnings.map((warning, index) => (
                  <Text key={index} style={styles.warningText}>• {warning}</Text>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* Impact on Today */}
        {dailyTargets ? (
          <Card style={styles.impactCard} elevation="sm">
            <View style={styles.impactHeader}>
              <Text style={styles.sectionTitle}>Impact on today</Text>
              <Badge label="Goals" tone="info" />
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Calories left</Text>
              <Text style={styles.impactValue}>
                {Math.max(0, dailyTargets.calories - scaled.calories)} cal
              </Text>
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Protein</Text>
              <Text style={styles.impactValue}>
                {Math.max(0, dailyTargets.protein - scaled.protein).toFixed(0)} g
              </Text>
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Carbs</Text>
              <Text style={styles.impactValue}>
                {Math.max(0, dailyTargets.carbs - scaled.carbs).toFixed(0)} g
              </Text>
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Fat</Text>
              <Text style={styles.impactValue}>
                {Math.max(0, dailyTargets.fat - scaled.fat).toFixed(0)} g
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Micronutrients Section - Only Saturated Fat */}
        {hasMicronutrients && (
          <View style={styles.collapsibleSection}>
            <Pressable
              style={({ pressed }) => [
                styles.collapsibleHeader,
                pressed && styles.collapsibleHeaderPressed,
              ]}
              onPress={() => setShowMicros(!showMicros)}>
              <View style={styles.collapsibleHeaderLeft}>
                <MaterialCommunityIcons name="nutrition" size={20} color={DesignColors.black} />
                <Text style={styles.collapsibleTitle}>Micronutrients</Text>
              </View>
              <Feather name={showMicros ? 'chevron-up' : 'chevron-down'} size={20} color={DesignColors.gray500} />
            </Pressable>

            {showMicros && (
              <View style={styles.microsList}>
                {scaled.saturatedFat > 0 && (
                  <MicronutrientRow label="Saturated Fat" value={scaled.saturatedFat} unit="g" dailyValue={20} icon="water-outline" />
                )}
              </View>
            )}
          </View>
        )}

        {/* Adjustments Section */}
        {(adjustments.length > 0 || hasAdjustedIngredients) && (
          <View style={styles.adjustmentsSection}>
            <View style={styles.adjustmentsHeader}>
              <Feather name="edit-3" size={16} color={DesignColors.gray500} />
              <Text style={styles.adjustmentsTitle}>
                {adjustments.length} adjustment{adjustments.length !== 1 ? 's' : ''} applied
              </Text>
            </View>
            <Text style={styles.adjustmentsHint}>
              Portions were validated against typical serving sizes
            </Text>
          </View>
        )}

        {/* Ingredient Breakdown */}
        {ingredients.length > 0 && (
          <View style={styles.collapsibleSection}>
            <Pressable
              style={({ pressed }) => [
                styles.collapsibleHeader,
                pressed && styles.collapsibleHeaderPressed,
              ]}
              onPress={() => setShowBreakdown(!showBreakdown)}>
              <View style={styles.collapsibleHeaderLeft}>
                <Feather name="list" size={20} color={DesignColors.black} />
                <Text style={styles.collapsibleTitle}>
                  Ingredients ({ingredients.length})
                </Text>
              </View>
              <Feather name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={20} color={DesignColors.gray500} />
            </Pressable>

            {showBreakdown && (
              <View style={styles.ingredientsList}>
                {ingredients.map((ingredient, index) => (
                  <View key={index} style={[
                    styles.ingredientItem,
                    ingredient.wasAdjusted && styles.ingredientItemAdjusted
                  ]}>
                    <View style={styles.ingredientHeader}>
                      <View style={styles.ingredientNameRow}>
                        <Text style={styles.ingredientName}>{ingredient.name}</Text>
                        {ingredient.wasAdjusted && (
                          <View style={styles.adjustedBadge}>
                            <Text style={styles.adjustedBadgeText}>Adjusted</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.ingredientQty}>
                        {Math.round(ingredient.quantity * portionMultiplier)}{ingredient.unit}
                      </Text>
                    </View>
                    {ingredient.wasAdjusted && ingredient.adjustmentReason && (
                      <Text style={styles.adjustmentReason}>{ingredient.adjustmentReason}</Text>
                    )}
                    <View style={styles.ingredientNutrition}>
                      <Text style={styles.ingredientCal}>
                        {Math.round(ingredient.calories * portionMultiplier)} cal
                      </Text>
                      <Text style={styles.ingredientMacro}>
                        P: {Math.round(ingredient.protein * portionMultiplier)}g
                      </Text>
                      <Text style={styles.ingredientMacro}>
                        C: {Math.round(ingredient.carbs * portionMultiplier)}g
                      </Text>
                      <Text style={styles.ingredientMacro}>
                        F: {Math.round(ingredient.fat * portionMultiplier)}g
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.retakeButton,
            pressed && styles.retakeButtonPressed,
          ]}
          onPress={() => router.back()}>
          <Feather name="camera" size={20} color={DesignColors.gray500} />
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            isSaving && styles.saveButtonDisabled,
            pressed && !isSaving && styles.saveButtonPressed,
          ]}
          onPress={handleSave}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={DesignColors.white} />
          ) : (
            <>
              <Text style={styles.saveText}>Save to Log</Text>
              <Feather name="check" size={20} color={DesignColors.white} />
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
    backgroundColor: DesignColors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: DesignColors.gray100,
  },
  foodImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  nameSection: {
    gap: 4,
  },
  foodName: {
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
  },
  servingSize: {
    fontSize: 15,
    color: DesignColors.gray500,
  },
  portionSection: {
    backgroundColor: DesignColors.gray50,
    borderRadius: 16,
    padding: 16,
    gap: Spacing.md,
  },
  portionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: DesignColors.gray500,
    marginBottom: 10,
  },
  portionControlGroup: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  portionButtons: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
  },
  sliderContainer: {
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  portionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: DesignColors.white,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    alignItems: 'center',
  },
  portionButtonActive: {
    backgroundColor: DesignColors.primary,
    borderColor: DesignColors.primary,
  },
  portionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  portionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignColors.gray500,
  },
  portionButtonTextActive: {
    color: DesignColors.white,
  },
  portionButtonTextPressed: {
    color: DesignColors.gray700,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    ...Typography.caption,
    color: DesignColors.gray500,
  },
  sliderValue: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  stackCard: {
    gap: Spacing.lg,
  },
  heroCalories: {
    gap: 2,
    marginBottom: 4,
  },
  overline: {
    fontSize: 12,
    fontWeight: '600',
    color: DesignColors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  caloriesValue: {
    fontSize: 56,
    fontWeight: '800',
    color: DesignColors.textPrimary,
  },
  caloriesLabel: {
    fontSize: 12,
    color: DesignColors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  caloriesOriginal: {
    fontSize: 12,
    color: DesignColors.gray400,
    marginTop: 4,
  },
  macrosSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignColors.black,
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  impactCard: {
    gap: Spacing.sm,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  impactLabel: {
    ...Typography.bodySmall,
    color: DesignColors.gray600,
  },
  impactValue: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  confidenceWarningGroup: {
    gap: 10,
    marginTop: 4,
  },
  confidenceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  confidenceBannerHigh: {
    backgroundColor: DesignColors.successBg,
    borderColor: DesignColors.successBorder,
  },
  confidenceBannerMedium: {
    backgroundColor: DesignColors.warningBg,
    borderColor: DesignColors.warningBorder,
  },
  confidenceBannerLow: {
    backgroundColor: DesignColors.errorBg,
    borderColor: DesignColors.errorBorder,
  },
  warningBanner: {
    backgroundColor: DesignColors.warningBg,
    borderWidth: 1,
    borderColor: DesignColors.warningBorder,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  confidenceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  confidenceBoxHigh: {
    backgroundColor: DesignColors.successBg,
    borderColor: DesignColors.successBorder,
  },
  confidenceBoxMedium: {
    backgroundColor: DesignColors.warningBg,
    borderColor: DesignColors.warningBorder,
  },
  confidenceBoxLow: {
    backgroundColor: DesignColors.errorBg,
    borderColor: DesignColors.errorBorder,
  },
  confidenceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  confidenceTextHigh: {
    color: DesignColors.successDark,
  },
  confidenceTextMedium: {
    color: DesignColors.warningDark,
  },
  confidenceTextLow: {
    color: DesignColors.errorRedDark,
  },
  warningsSection: {
    backgroundColor: DesignColors.warningBg,
    borderWidth: 1,
    borderColor: DesignColors.warningBorder,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.warningDark,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    color: DesignColors.warningDark,
    paddingLeft: 4,
  },
  collapsibleSection: {
    backgroundColor: DesignColors.gray50,
    borderRadius: 16,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  collapsibleHeaderPressed: {
    backgroundColor: DesignColors.gray100,
    opacity: 0.9,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collapsibleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignColors.black,
  },
  microsList: {
    padding: 14,
    paddingTop: 0,
    gap: 10,
  },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  microLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  microLabel: {
    fontSize: 14,
    color: DesignColors.gray700,
  },
  microRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  microValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.black,
  },
  microDvBadge: {
    backgroundColor: DesignColors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  microDvBadgeHigh: {
    backgroundColor: DesignColors.infoBg,
  },
  microDvText: {
    fontSize: 11,
    color: DesignColors.gray500,
  },
  microDvTextHigh: {
    color: DesignColors.infoDark,
    fontWeight: '500',
  },
  adjustmentsSection: {
    backgroundColor: DesignColors.gray50,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  adjustmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustmentsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: DesignColors.gray700,
  },
  adjustmentsHint: {
    fontSize: 12,
    color: DesignColors.gray400,
    paddingLeft: 24,
  },
  ingredientsList: {
    padding: 14,
    paddingTop: 0,
    gap: 12,
  },
  ingredientItem: {
    backgroundColor: DesignColors.white,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  ingredientItemAdjusted: {
    borderWidth: 1,
    borderColor: DesignColors.warningBorder,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.black,
  },
  adjustedBadge: {
    backgroundColor: DesignColors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adjustedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: DesignColors.warningDark,
  },
  ingredientQty: {
    fontSize: 13,
    color: DesignColors.gray500,
  },
  adjustmentReason: {
    fontSize: 12,
    color: DesignColors.warningDark,
    fontStyle: 'italic',
  },
  ingredientNutrition: {
    flexDirection: 'row',
    gap: 12,
  },
  ingredientCal: {
    fontSize: 12,
    fontWeight: '600',
    color: DesignColors.black,
  },
  ingredientMacro: {
    fontSize: 12,
    color: DesignColors.gray500,
  },
  footer: {
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: DesignColors.gray200,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  retakeButtonPressed: {
    opacity: 0.7,
  },
  retakeText: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignColors.gray600,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#171717',
    shadowColor: '#171717',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonPressed: {
    backgroundColor: DesignColors.gray800,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: DesignColors.white,
  },
});
