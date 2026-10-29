import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { MealEditor } from '@/components/meal-log/MealEditor';
import { IngredientEditor } from '@/components/meal-log/IngredientEditor';
import { MealScopeReview } from '@/components/meal-log/MealScopeReview';
import { addAnalysisFat, confirmAnalysisFat, confirmAnalysisRegion, hasPendingAnalysisReview, selectAnalysisRegion } from '@/services/analysisScope';
import { hasCompleteNutrition, recalculateAnalysis, replaceAnalysisIngredient } from '@/services/analysisNutrition';
import type { AnalysisIngredient } from '@/lib/advanced-food-analysis-types';
import { DesignColors } from '@/constants/theme';
import { useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import type { AddMealInput } from '@/lib/meal-log-types';
import { getLocalDateKey } from '@/lib/mealDates';
import { getLoggedAtForDate } from '@/services/mealValidation';
import { useMealDraftStore } from '@/store/mealDraftStore';
import {
  getAnalysisAdjustments,
  analyzeAdvancedFoodImage,
  getAnalysisDisplayName,
  getAnalysisIngredientViews,
  getAnalysisServingSizeLabel,
  getMealInputFromAnalysis,
  isSuccessfulAnalysisData,
  type SuccessfulAnalysisData,
} from '@/services/foodAnalysis';

const PORTION_PRESETS = [
  { label: '½', multiplier: 0.5 },
  { label: '1×', multiplier: 1 },
  { label: '1½', multiplier: 1.5 },
  { label: '2×', multiplier: 2 },
] as const;

function formatAmount(value: number, unit: string): string {
  const amount = unit === 'g' || unit === 'ml'
    ? Math.round(value)
    : Number(value.toFixed(1));
  return `${amount} ${unit}`;
}

function getSelectedServingLabel(label: string, multiplier: number): string {
  const measuredServing = label.match(/^(\d+(?:\.\d+)?)(g|ml)$/);
  if (measuredServing) {
    return formatAmount(Number(measuredServing[1]) * multiplier, measuredServing[2]);
  }

  return multiplier === 1 ? label : `${label} × ${multiplier}`;
}

export default function FoodResultScreen() {
  const params = useLocalSearchParams<{ draftId?: string; analysisData?: string; imageUri?: string; date?: string }>();
  const session = useSessionStore((state) => state.session);
  const draft = useMealDraftStore(state => state.ownerId === session?.user.id && params.draftId ? state.drafts[params.draftId] : undefined);

  const analysisData = useMemo<SuccessfulAnalysisData | null>(() => {
    if (params.draftId) return (draft?.currentAnalysis ?? draft?.originalAnalysis)?.data ?? null;
    if (!params.analysisData) return null;

    try {
      const parsed: unknown = JSON.parse(params.analysisData);
      return isSuccessfulAnalysisData(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [params.draftId, params.analysisData, draft]);

  if (!analysisData) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <Feather name="arrow-left" size={23} color={DesignColors.black} />
          </Pressable>
          <Text style={styles.headerTitle}>Review meal</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Result unavailable</Text>
          <Text style={styles.emptyDescription}>Please scan your meal again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initialInput = draft?.input ?? getMealInputFromAnalysis(analysisData, 1, params.imageUri, { loggedAt: getLoggedAtForDate(params.date) });
  return <MealReview key={params.draftId ?? params.analysisData} analysisData={analysisData} initialInput={initialInput} draftId={params.draftId} />;
}

function MealReview({ analysisData: initialAnalysisData, initialInput, draftId }: { analysisData: SuccessfulAnalysisData; initialInput: AddMealInput; draftId?: string }) {
  const session = useSessionStore(state => state.session);
  const addMeal = useMealLogStore(state => state.addMeal);
  const [mealInput, setMealInput] = useState(initialInput);
  const [analysisData, setAnalysisData] = useState(initialAnalysisData);
  const [editingIngredient, setEditingIngredient] = useState<number | null>(null);
  const [addingFatRegion, setAddingFatRegion] = useState<number | null>(null);
  const [manualOverride, setManualOverride] = useState(initialInput.nutritionStatus === 'complete' && !hasCompleteNutrition(initialAnalysisData));
  const [isEditing, setIsEditing] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showEstimateDetails, setShowEstimateDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const ingredients = getAnalysisIngredientViews(analysisData);
  const adjustments = getAnalysisAdjustments(analysisData);
  const portionMultiplier = mealInput.quantity ?? 1;
  const imageUri = mealInput.imageUri;
  const nutritionEdited = manualOverride || mealInput.calories !== analysisData.totalNutrition.calories ||
    mealInput.macros.protein !== analysisData.totalNutrition.protein || mealInput.macros.carbs !== analysisData.totalNutrition.carbs ||
    mealInput.macros.fat !== analysisData.totalNutrition.fat;

  const updateInput = (input: AddMealInput) => {
    if (isSaving || isRetrying) return;
    if (draftId && (!session?.user.id || !useMealDraftStore.getState().updateDraft(session.user.id, draftId, input))) {
      Alert.alert('Result unavailable', 'Please scan your meal again.');
      return;
    }
    setMealInput(input);
    setManualOverride(input.nutritionStatus === 'complete' && (!hasCompleteNutrition(analysisData) || input.calories !== analysisData.totalNutrition.calories || input.macros.protein !== analysisData.totalNutrition.protein || input.macros.carbs !== analysisData.totalNutrition.carbs || input.macros.fat !== analysisData.totalNutrition.fat));
    setIsEditing(false);
  };

  const nutritionComplete = hasCompleteNutrition(analysisData) || manualOverride;
  const reviewPending = hasPendingAnalysisReview(analysisData);
  const saveAllowed = !reviewPending && (manualOverride || (nutritionComplete && analysisData.ingredients.length > 0));
  const updateAnalysis = (next: SuccessfulAnalysisData) => {
    if (!session?.user.id || isSaving || isRetrying) return;
    if (draftId && !useMealDraftStore.getState().updateAnalysis(session.user.id, draftId, { success: true, data: next })) {
      Alert.alert('Session expired', 'Please sign in again.');
      return;
    }
    const base = getMealInputFromAnalysis(next, mealInput.quantity ?? 1, mealInput.imageUri, {
      loggedAt: mealInput.loggedAt, mealType: mealInput.mealType,
    });
    setAnalysisData(next);
    setMealInput({ ...base, name: mealInput.name });
    setManualOverride(false);
    setEditingIngredient(null);
    setAddingFatRegion(null);
  };
  const updateIngredients = (nextIngredients: AnalysisIngredient[]) => updateAnalysis(recalculateAnalysis(analysisData, nextIngredients));

  const foodName = mealInput.name.trim() || getAnalysisDisplayName(analysisData).trim() || 'Your meal';
  const displayName = foodName.charAt(0).toUpperCase() + foodName.slice(1);
  const servingLabel = getSelectedServingLabel(
    getAnalysisServingSizeLabel(analysisData),
    portionMultiplier
  );
  const nutrition = { calories: mealInput.calories, ...mealInput.macros };
  const calories = Math.round(nutrition.calories * portionMultiplier);
  const protein = Math.round(nutrition.protein * portionMultiplier);
  const carbs = Math.round(nutrition.carbs * portionMultiplier);
  const fat = Math.round(nutrition.fat * portionMultiplier);
  const confidence = Math.round(analysisData.confidence);
  const lowConfidence = confidence < 50;
  const warnings = analysisData.warnings ?? [];
  const recipeEstimates = analysisData.ingredients.filter(ingredient => ingredient.nutrition?.reference?.matchQuality === 'approximate');
  const genericIngredients = ingredients
    .filter((ingredient) => ingredient.unresolved)
    .map((ingredient) => ingredient.name);

  const handleSave = async () => {
    if (isSaving || !saveAllowed) return;

    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Session expired', 'Please sign in again to save your meal.');
      return;
    }

    setIsSaving(true);
    try {
      const base = getMealInputFromAnalysis(analysisData, portionMultiplier, imageUri, {
        loggedAt: mealInput.loggedAt, mealType: mealInput.mealType,
      });
      await addMeal(userId, {
        ...base, name: mealInput.name, calories: mealInput.calories, macros: mealInput.macros, nutritionStatus: nutritionComplete ? 'complete' : 'incomplete',
        note: nutritionEdited ? `${base.note} · Nutrition edited by you` : base.note,
      });
      if (useSessionStore.getState().session?.user.id !== userId) return;
      if (draftId) useMealDraftStore.getState().discardDraft(userId, draftId);
      router.replace({ pathname: '/(app)/(tabs)', params: { date: getLocalDateKey(new Date(mealInput.loggedAt!)) } });
    } catch (error) {
      console.error('Failed to save meal', error);
      Alert.alert('Unable to save meal', 'Please try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  const retryEstimate = async () => {
    const userId = session?.user.id;
    if (!userId || !imageUri || isRetrying || isSaving) return;
    setIsRetrying(true);
    try {
      const result = await analyzeAdvancedFoodImage(imageUri);
      if (useSessionStore.getState().session?.user.id !== userId) return;
      if (!result.success || !result.data) throw new Error(result.error || 'Please try a clearer photo.');
      if (draftId && !useMealDraftStore.getState().updateAnalysis(userId, draftId, result)) throw new Error('Please scan your meal again.');
      setAnalysisData(result.data);
      setMealInput({ ...getMealInputFromAnalysis(result.data, portionMultiplier, imageUri, { loggedAt: mealInput.loggedAt, mealType: mealInput.mealType }), name: mealInput.name });
      setManualOverride(false);
    } catch (error) {
      Alert.alert('Estimate unavailable', error instanceof Error ? error.message : 'Please try again shortly.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Feather name="arrow-left" size={23} color={DesignColors.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Review meal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.foodImage} />
        ) : null}

        <View style={styles.summary}>
          <View style={styles.estimateTag}>
            <Feather name="camera" size={14} color={DesignColors.gray700} />
            <Text style={styles.estimateTagText}>{nutritionEdited ? 'Nutrition edited by you' : 'Estimated from photo'}</Text>
          </View>
          <Text style={styles.foodName}>{displayName}</Text>
          <Text style={styles.servingText}>{analysisData.ingredients.some(ingredient => ingredient.quantitySource === 'user') ? 'Corrected portion' : 'Estimated portion'}: {servingLabel}</Text>
          <Text style={styles.servingText}>
            {(mealInput.mealType ?? 'snack').toUpperCase()} · {new Date(mealInput.loggedAt!).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)} disabled={isSaving || isRetrying} style={styles.editButton}>
            <Feather name="edit-2" size={16} color={DesignColors.primary} />
            <Text style={styles.editText}>Edit meal details</Text>
          </Pressable>
          <View style={styles.calorieRow}>
            <Text style={styles.calorieNumber}>≈ {calories}</Text>
            <Text style={styles.calorieUnit}>{nutritionComplete ? 'calories' : 'calories known'}</Text>
          </View>
        </View>

        {!nutritionComplete ? <Text style={styles.detailText}>We couldn’t finish this estimate. The numbers include only matched foods. Retry the analysis or take a clearer photo.</Text> : null}
        <MealScopeReview data={analysisData} disabled={isSaving || isRetrying}
          onSelect={(index, selected) => updateAnalysis(selectAnalysisRegion(analysisData, index, selected))}
          onConfirm={index => updateAnalysis(confirmAnalysisRegion(analysisData, index))}
          onConfirmFat={index => updateAnalysis(confirmAnalysisFat(analysisData, index))}
          onAddFat={index => setAddingFatRegion(index)} />
        <View style={styles.portionCard}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Portion</Text>
            <Text style={styles.sectionHint}>Adjust if needed</Text>
          </View>
          <View style={styles.portionButtons}>
            {PORTION_PRESETS.map((preset) => {
              const selected = portionMultiplier === preset.multiplier;
              return (
                <Pressable
                  key={preset.multiplier}
                  accessibilityRole="button"
                  accessibilityLabel={`${preset.multiplier} times the estimated portion`}
                  accessibilityState={{ selected }}
                  onPress={() => updateInput({ ...mealInput, quantity: preset.multiplier })}
                  disabled={isSaving || isRetrying}
                  style={({ pressed }) => [
                    styles.portionButton,
                    selected && styles.portionButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.portionButtonText, selected && styles.portionButtonTextSelected]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.macroDivider} />
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, styles.proteinDot]} />
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroValue}>{protein} g</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, styles.carbsDot]} />
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroValue}>{carbs} g</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, styles.fatDot]} />
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroValue}>{fat} g</Text>
            </View>
          </View>
        </View>

        <View style={[
          styles.reviewNote,
          (lowConfidence || genericIngredients.length > 0) && styles.reviewNoteAttention,
        ]}>
          <Feather
            name={lowConfidence || genericIngredients.length > 0 ? 'alert-circle' : 'info'}
            size={17}
            color={lowConfidence || genericIngredients.length > 0
              ? DesignColors.warningDark
              : DesignColors.gray700}
          />
          <Text style={styles.reviewNoteText}>
            {genericIngredients.length > 0
              ? 'Some foods could not be estimated automatically this time.'
              : lowConfidence
              ? 'The food was hard to identify. Retake the photo if this looks wrong.'
              : recipeEstimates.length > 0 ? 'Estimated using typical recipes. Details are available below.'
              : 'Estimated from your photo and food nutrition records.'}
          </Text>
        </View>

        {ingredients.length > 0 ? (
          <View style={styles.detailSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showIngredients }}
              onPress={() => setShowIngredients((current) => !current)}
              style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}>
              <View style={styles.detailTitleRow}>
                <Feather name="list" size={18} color={DesignColors.black} />
                <Text style={styles.detailTitle}>Ingredients</Text>
                <Text style={styles.detailCount}>{ingredients.length}</Text>
              </View>
              <Feather
                name={showIngredients ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={DesignColors.gray600}
              />
            </Pressable>
            {showIngredients ? (
              <View style={styles.detailBody}>
                {nutritionEdited ? <Text style={styles.detailText}>Your complete meal nutrition override is used for the total. Ingredient values are shown separately; changing an ingredient clears the override.</Text> : null}
                {ingredients.map((ingredient, index) => (
                  <Pressable key={`${ingredient.name}-${index}`} accessibilityRole="button" accessibilityLabel={'Correct ' + ingredient.name} disabled={isSaving || isRetrying} onPress={() => setEditingIngredient(index)} style={styles.ingredientRow}>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>{ingredient.name}</Text>
                      <Text style={styles.ingredientAmount}>
                        {formatAmount(ingredient.quantity * portionMultiplier, ingredient.unit)}{ingredient.quantitySource === 'user' ? ' · Corrected' : ' · Estimated'}
                        {ingredient.referenceName ? '\n' + ingredient.referenceName : ''}
                      </Text>
                    </View>
                    <Text style={styles.ingredientCalories}>
                      {ingredient.unresolved || ingredient.calories === null ? 'Needs match' : Math.round(ingredient.calories * portionMultiplier) + ' cal'}
                      <Text style={styles.editText}>{'\n'}Edit</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.detailSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showEstimateDetails }}
            onPress={() => setShowEstimateDetails((current) => !current)}
            style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}>
            <View style={styles.detailTitleRow}>
              <Feather name="help-circle" size={18} color={DesignColors.black} />
              <Text style={styles.detailTitle}>About this estimate</Text>
            </View>
            <Feather
              name={showEstimateDetails ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={DesignColors.gray600}
            />
          </Pressable>
          {showEstimateDetails ? (
            <View style={styles.detailBody}>
              <Text style={styles.detailText}>
                Original analysis confidence: {confidence}%. This is not a measure of calorie accuracy.
              </Text>
              {warnings.map((warning, index) => (
                <Text key={`warning-${index}`} style={styles.detailText}>• {warning}</Text>
              ))}
              {recipeEstimates.map((ingredient, index) => <Text key={`recipe-${index}`} style={styles.detailText}>
                {ingredient.name}: {ingredient.nutrition?.reference?.matchReason || 'A compatible typical recipe was used.'}
              </Text>)}
              {analysisData.ingredients.filter(ingredient => ingredient.estimatedWeightRange && ingredient.quantitySource !== 'user').map((ingredient, index) => <Text key={`range-${index}`} style={styles.detailText}>
                {ingredient.name}: estimated {Math.round(ingredient.estimatedWeightRange!.min * portionMultiplier)}–{Math.round(ingredient.estimatedWeightRange!.max * portionMultiplier)} g. This range is an estimate from the photo.
              </Text>)}
              {adjustments.map((adjustment, index) => (
                <Text key={`adjustment-${index}`} style={styles.detailText}>• {adjustment}</Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.retakeButton, pressed && styles.pressed]}>
          <Feather name="camera" size={19} color={DesignColors.black} />
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving || isRetrying || reviewPending || (!saveAllowed && !imageUri) }}
          onPress={saveAllowed ? handleSave : retryEstimate}
          disabled={isSaving || isRetrying || reviewPending || (!saveAllowed && !imageUri)}
          style={({ pressed }) => [
            styles.saveButton,
            (isSaving || isRetrying || reviewPending || (!saveAllowed && !imageUri)) && styles.saveButtonDisabled,
            pressed && !isSaving && styles.pressed,
          ]}>
          {isSaving || isRetrying ? (
            <ActivityIndicator size="small" color={DesignColors.white} />
          ) : (
            <Text style={styles.saveText}>{reviewPending ? 'Confirm foods and portion above' : saveAllowed ? 'Save meal' : 'Retry estimate'}</Text>
          )}
        </Pressable>
      </View>
      {editingIngredient !== null && analysisData.ingredients[editingIngredient] ? (
        <Modal visible animationType="slide" onRequestClose={() => setEditingIngredient(null)}>
          <SafeAreaView style={styles.editorContainer} edges={['top', 'bottom', 'left', 'right']}>
            <IngredientEditor ingredient={analysisData.ingredients[editingIngredient]}
              regionAmount={analysisData.ingredients[editingIngredient].regionIndex === undefined ? undefined : analysisData.ingredients.filter(ingredient => ingredient.regionIndex === analysisData.ingredients[editingIngredient].regionIndex && ingredient.unit === 'g').reduce((sum, ingredient) => sum + ingredient.quantity, 0)}
              onApply={(ingredient, wholeDish) => updateIngredients(replaceAnalysisIngredient(analysisData, editingIngredient, ingredient, wholeDish).ingredients)}
              onRemove={() => updateIngredients(analysisData.ingredients.filter((_, index) => index !== editingIngredient))}
              onCancel={() => setEditingIngredient(null)} />
          </SafeAreaView>
        </Modal>
      ) : null}
      {isEditing ? (
        <Modal visible animationType="slide" onRequestClose={() => setIsEditing(false)}>
          <SafeAreaView style={styles.editorContainer} edges={['top', 'bottom', 'left', 'right']}>
            <MealEditor initialInput={mealInput} requireNutritionEntry={!nutritionComplete} onSubmit={input => updateInput({ ...input, nutritionStatus: 'complete' })} onCancel={() => setIsEditing(false)} />
          </SafeAreaView>
        </Modal>
      ) : null}
      {addingFatRegion !== null ? (
        <Modal visible animationType="slide" onRequestClose={() => setAddingFatRegion(null)}>
          <SafeAreaView style={styles.editorContainer} edges={['top', 'bottom', 'left', 'right']}>
            <IngredientEditor isNew ingredient={{ name: 'Oil or dressing', quantity: 1, unit: 'g', confidence: 100,
              quantitySource: 'user', representation: 'component', extraWithWholeDish: true, isAddedFat: true,
              nutritionStatus: 'unresolved', nutrition: null, scaledNutrition: null, unresolvedReason: 'Enter the food, amount and nutrition.' }}
              onApply={ingredient => updateAnalysis(addAnalysisFat(analysisData, addingFatRegion, ingredient))}
              onRemove={() => setAddingFatRegion(null)} onCancel={() => setAddingFatRegion(null)} />
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DesignColors.white },
  editorContainer: { flex: 1, backgroundColor: DesignColors.white },
  editButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  editText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: DesignColors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DesignColors.gray100,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  headerSpacer: { width: 44 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  foodImage: {
    width: '100%',
    height: 190,
    borderRadius: 20,
    backgroundColor: DesignColors.gray100,
  },
  summary: { gap: 5 },
  estimateTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: DesignColors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  estimateTagText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: DesignColors.gray700 },
  foodName: { fontSize: 24, lineHeight: 31, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  servingText: { fontSize: 13, color: DesignColors.gray600 },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  calorieNumber: { fontSize: 42, lineHeight: 49, fontFamily: 'Manrope_800ExtraBold', color: DesignColors.black },
  calorieUnit: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: DesignColors.gray600 },
  portionCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    borderRadius: 20,
    gap: 14,
  },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  sectionHint: { fontSize: 12, color: DesignColors.gray600 },
  portionButtons: { flexDirection: 'row', gap: 8 },
  portionButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: DesignColors.gray100,
  },
  portionButtonSelected: { backgroundColor: DesignColors.black },
  portionButtonText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: DesignColors.gray700 },
  portionButtonTextSelected: { color: DesignColors.white },
  macroDivider: { height: 1, backgroundColor: DesignColors.gray200 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  macroDot: { width: 7, height: 7, borderRadius: 4 },
  proteinDot: { backgroundColor: DesignColors.protein },
  carbsDot: { backgroundColor: DesignColors.carbs },
  fatDot: { backgroundColor: DesignColors.fat },
  macroLabel: { fontSize: 12, color: DesignColors.gray600 },
  macroValue: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: DesignColors.gray100,
  },
  reviewNoteAttention: { backgroundColor: DesignColors.warningBg },
  reviewNoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: DesignColors.gray700 },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: DesignColors.gray200,
  },
  detailButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  detailCount: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 12,
    color: DesignColors.gray700,
    backgroundColor: DesignColors.gray100,
    borderRadius: 11,
    overflow: 'hidden',
  },
  detailBody: { paddingBottom: 10, gap: 9 },
  detailText: { fontSize: 13, lineHeight: 20, color: DesignColors.gray700 },
  ingredientRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ingredientInfo: { flex: 1 },
  ingredientName: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: DesignColors.black },
  ingredientAmount: { fontSize: 12, color: DesignColors.gray600 },
  ingredientCalories: { fontSize: 13, color: DesignColors.gray700 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: DesignColors.gray200,
    backgroundColor: DesignColors.white,
  },
  retakeButton: {
    minWidth: 96,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  retakeText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: DesignColors.black },
  saveButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: DesignColors.black,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: DesignColors.white },
  pressed: { opacity: 0.75 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: DesignColors.black },
  emptyDescription: { fontSize: 14, color: DesignColors.gray600, textAlign: 'center' },
});
