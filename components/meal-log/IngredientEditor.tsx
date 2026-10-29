import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { DesignColors, Spacing, BorderRadius } from '@/constants/theme';
import type { AnalysisIngredient } from '@/lib/advanced-food-analysis-types';
import type { NutritionReference } from '@/lib/nutrition-types';
import { correctIngredientAmount, resolveIngredient, isWholeDishReference } from '@/services/analysisNutrition';
import { getNutritionReference, searchNutrition } from '@/services/nutritionLookup';

type Props = {
  ingredient: AnalysisIngredient;
  onApply: (ingredient: AnalysisIngredient, wholeDish: boolean) => void;
  regionAmount?: number;
  onRemove: () => void;
  onCancel: () => void;
  isNew?: boolean;
};

const parse = (text: string) => Number(text.trim().replace(',', '.'));

export function IngredientEditor({ ingredient, onApply, onRemove, onCancel, regionAmount, isNew = false }: Props) {
  const [amount, setAmount] = useState(isNew ? '' : String(ingredient.quantity));
  const [unit, setUnit] = useState(ingredient.unit);
  const [servingIndex, setServingIndex] = useState(ingredient.servingIndex);
  const [query, setQuery] = useState(ingredient.name);
  const [reference, setReference] = useState<NutritionReference | undefined>(ingredient.nutrition?.reference);
  const [candidates, setCandidates] = useState<NutritionReference[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [manualBasis, setManualBasis] = useState<'g' | 'ml' | 'serving'>('g');
  const [manualValues, setManualValues] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [message, setMessage] = useState('');

  const search = async () => {
    if (!query.trim() || isBusy) return;
    setIsBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await searchNutrition(query.trim());
      setCandidates(result.candidates);
      setMessage(result.candidates.length ? 'Choose the food and preparation that match your meal.' :
        result.reason ?? 'No complete records found. Try a more specific name or enter nutrition.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search is unavailable.');
    } finally {
      setIsBusy(false);
    }
  };

  const choose = async (candidate: NutritionReference) => {
    setIsBusy(true);
    setError('');
    try {
      const detailed = await getNutritionReference(candidate.id);
      setReference(detailed);
      if (isWholeDishReference(detailed) && regionAmount !== undefined) { setAmount(String(regionAmount)); setUnit('g'); setServingIndex(undefined); }
      setManual(false);
      setCandidates([]);
      setMessage('');
      // Keep the amount. An incompatible volume must be corrected explicitly.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this food.');
    } finally {
      setIsBusy(false);
    }
  };

  const apply = () => {
    setError('');
    try {
      if (!amount.trim()) throw new Error('Enter an amount greater than zero.');
      const quantity = parse(amount);
      const corrected = correctIngredientAmount(
        reference || manual ? { ...ingredient, nutritionStatus: 'unresolved', nutrition: null, scaledNutrition: null, source: undefined, unresolvedReason: '' } : ingredient,
        quantity, unit, servingIndex,
      );
      if (isNew) corrected.originalEstimate = undefined;
      let selected = reference;
      if (manual) {
        if (Object.values(manualValues).some(value => !value.trim())) throw new Error('Enter all four nutrition values, using 0 where appropriate.');
        const nutrients = {
          calories: parse(manualValues.calories), protein: parse(manualValues.protein),
          carbs: parse(manualValues.carbs), fat: parse(manualValues.fat),
        };
        if (Object.values(nutrients).some(value => !Number.isFinite(value) || value < 0)) throw new Error('Nutrition values must be nonnegative numbers.');
        selected = {
          id: 'manual', name: query.trim() || ingredient.name, source: 'manual',
          basisAmount: manualBasis === 'serving' ? 1 : 100, basisUnit: manualBasis,
          nutrients, servings: [],
        };
      }
      const named = { ...corrected, name: query.trim() || ingredient.name, foodName: query.trim() || ingredient.foodName,
        ...(selected ? { nutritionIdentityKnown: true, identityUncertain: false, identityAlternatives: [] } : {}) };
      onApply(selected ? resolveIngredient(named, selected) : named, !!selected && isWholeDishReference(selected));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check this food and amount.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.title}>Correct food and amount</Text>
        <Pressable accessibilityRole="button" disabled={isBusy} onPress={onCancel} style={styles.button}>
          <Text>Cancel</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.name}>{ingredient.name}</Text>
        <Text style={styles.hint}>{isNew ? 'Enter the amount and choose nutrition for the oil or dressing you consumed.' : `Photo estimate: ${ingredient.originalEstimate?.quantity ?? ingredient.quantity} ${ingredient.originalEstimate?.unit ?? ingredient.unit}. Enter amounts for the base meal (1×).`}</Text>
        {ingredient.identityAlternatives?.length ? <Text style={styles.hint}>Possible identities: {ingredient.identityAlternatives.join(' or ')}. Confirm the food before choosing nutrition.</Text> : null}
        <Text style={styles.label}>Amount</Text>
        <TextInput accessibilityLabel="Ingredient amount" style={styles.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={!isBusy} />
        <View style={styles.choices}>
          {(['g', 'ml'] as const).map(value => <Chip key={value} label={value} selected={unit === value} disabled={isBusy} onPress={() => { setUnit(value); setServingIndex(undefined); }} />)}
          {(reference?.basisUnit === 'serving' || ingredient.unit === 'serving' || (manual && manualBasis === 'serving')) ?
            <Chip label="Serving" selected={unit === 'serving' && servingIndex === undefined} disabled={isBusy} onPress={() => { setUnit('serving'); setServingIndex(undefined); }} /> : null}
          {reference?.servings.map((serving, index) =>
            <Chip key={index} label={serving.name + ' (' + serving.grams + ' g' + (serving.volumeMl ? ' / ' + serving.volumeMl + ' ml' : '') + ')'} selected={unit === 'serving' && servingIndex === index}
              disabled={isBusy} onPress={() => { setUnit('serving'); setServingIndex(index); setAmount('1'); }} />)}
        </View>
        <Text style={styles.hint}>For a serving option, the amount is the number of that serving. Grams and milliliters are not interchangeable.</Text>
        <Text style={styles.label}>Food and preparation</Text>
        <TextInput accessibilityLabel="Search food and preparation" style={styles.input} value={query} onChangeText={setQuery} editable={!isBusy} onSubmitEditing={search} />
        <Pressable accessibilityRole="button" disabled={isBusy || !query.trim()} onPress={search} style={styles.action}>
          <Text style={styles.actionText}>Search FatSecret foods</Text>
        </Pressable>
        {message ? <Text style={styles.hint}>{message}</Text> : null}
        {candidates.map(candidate => (
          <Pressable key={candidate.id} accessibilityRole="button" disabled={isBusy} onPress={() => choose(candidate)} style={styles.candidate}>
            <Text>{candidate.name}</Text>
            <Text style={styles.hint}>{Math.round(candidate.nutrients.calories)} calories / {candidate.basisAmount} {candidate.basisUnit} · FatSecret{candidate.recipeAverage ? ' · Recipe average' : ''}</Text>
          </Pressable>
        ))}
        {reference && !manual ? <View style={styles.candidate}>
          <Text style={styles.label}>Selected: {reference.name}</Text>
          {isWholeDishReference(reference) ? <Text style={styles.hint}>This is a whole prepared dish. Applying it replaces the other ingredients detected in this same dish. Enter the weight of the whole dish, excluding separate sides.</Text> : null}
          <Text style={styles.hint}>{reference.source === 'fatsecret' ? 'FatSecret reference' : 'Entered by you'} · {reference.basisAmount} {reference.basisUnit}{reference.recipeAverage ? ' · Recipe average; your recipe may differ.' : ''}</Text>
          {reference.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(reference.sourceUrl!)} style={styles.button}><Text style={styles.link}>View nutrition source</Text></Pressable> : null}
        </View> : null}
        <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => setManual(!manual)} style={styles.button}>
          <Text style={styles.link}>{manual ? 'Use database nutrition' : 'Enter nutrition manually'}</Text>
        </Pressable>
        {manual ? <>
          <Text style={styles.hint}>Copy nutrition from a label or known recipe. Values below apply to this basis, not automatically to your estimated amount.</Text>
          <View style={styles.choices}>
            {(['g', 'ml', 'serving'] as const).map(value => <Chip key={value}
              label={value === 'serving' ? 'Per serving' : 'Per 100 ' + value}
              selected={manualBasis === value} onPress={() => setManualBasis(value)} />)}
          </View>
          {(['calories', 'protein', 'carbs', 'fat'] as const).map(key => <View key={key}>
            <Text style={styles.label}>{key === 'calories' ? 'Calories (kcal)' : key.charAt(0).toUpperCase() + key.slice(1) + ' (g)'}</Text>
            <TextInput accessibilityLabel={'Manual ' + key} style={styles.input} keyboardType="decimal-pad" value={manualValues[key]}
              onChangeText={value => setManualValues(current => ({ ...current, [key]: value }))} />
          </View>)}
        </> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {isBusy ? <ActivityIndicator /> : null}
        <Pressable accessibilityRole="button" disabled={isBusy} onPress={onRemove} style={styles.button}>
          <Text style={styles.error}>Remove this detected food</Text>
        </Pressable>
      </ScrollView>
      <Pressable accessibilityRole="button" disabled={isBusy} onPress={apply} style={styles.footer}>
        <Text style={styles.actionText}>Apply correction</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DesignColors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  name: { fontFamily: 'Manrope_700Bold', fontSize: 22 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  label: { fontFamily: 'Manrope_600SemiBold', marginBottom: Spacing.xs },
  hint: { color: DesignColors.gray600, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: DesignColors.gray300, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: 'Manrope_400Regular' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 44, justifyContent: 'center' },
  action: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignColors.black, borderRadius: BorderRadius.md },
  actionText: { color: DesignColors.white, fontFamily: 'Manrope_600SemiBold', fontSize: 16 },
  candidate: { padding: Spacing.md, borderWidth: 1, borderColor: DesignColors.gray300, borderRadius: BorderRadius.md, gap: Spacing.sm },
  link: { color: DesignColors.primary },
  error: { color: DesignColors.errorRedDark },
  footer: { minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: DesignColors.black, margin: Spacing.lg, borderRadius: BorderRadius.md },
});
