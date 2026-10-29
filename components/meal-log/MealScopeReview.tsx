import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { DesignColors } from '@/constants/theme';
import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';
import { needsFatReview } from '@/services/analysisScope';

type Props = {
  data: NonNullable<AdvancedAnalysisResult['data']>;
  disabled: boolean;
  onSelect: (index: number, selected: boolean) => void;
  onConfirm: (index: number) => void;
  onConfirmFat: (index: number) => void;
  onAddFat: (index: number) => void;
};

export function MealScopeReview({ data, disabled, onSelect, onConfirm, onConfirmFat, onAddFat }: Props) {
  if (!data.regions.some(region => region.scope !== undefined || region.servingConfirmationRequired || region.reviewReasons?.length || region.fatAssessment === 'ambiguous')) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>What are you eating?</Text>
      <Text style={styles.detail}>The main dish is selected. Add accompanying food if it belongs to your meal.</Text>
      {data.regions.map((region, index) => {
        const items = [...data.ingredients, ...(data.excludedIngredients ?? [])].filter(item => item.regionIndex === index);
        if (!items.length) return null;
        const selected = region.selected !== false;
        const fatReview = needsFatReview(data, index);
        const needsReview = selected && (region.servingConfirmationRequired && !region.servingConfirmed ||
          !!region.reviewReasons?.length && !region.reviewConfirmed);
        return (
          <View key={index} style={styles.region}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={region.dishName || region.description} disabled={disabled}
              onPress={() => onSelect(index, !selected)} style={styles.action}>
              <Text style={styles.title}>{selected ? '✓ ' : '+ '}{region.dishName || region.description}</Text>
              <Text style={styles.detail}>{items.map(item => item.name).join(', ')}{region.scope === 'background' ? ' · Background' : ''}</Text>
            </Pressable>
            {fatReview ? <View>
              <Text style={styles.detail}>Is there extra oil or dressing? {region.fatEvidence}</Text>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onAddFat(index)} style={styles.action}><Text style={styles.link}>Add oil or dressing amount</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onConfirmFat(index)} style={styles.action}><Text style={styles.link}>No extra fat, or already included in the recipe</Text></Pressable>
            </View> : null}
            {needsReview ? (
              <View>
                {region.servingConfirmationRequired && !region.servingConfirmed ? <Text style={styles.detail}>This may be shared. The estimate covers all visible food. Choose your portion below before confirming.</Text> : null}
                {!region.reviewConfirmed ? region.reviewReasons?.map(reason => <Text key={reason} style={styles.detail}>{reason}</Text>) : null}
                <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onConfirm(index)} style={styles.action}>
                  <Text style={styles.link}>I checked the foods and my portion</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: DesignColors.gray100, borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: DesignColors.black },
  detail: { fontSize: 13, color: DesignColors.gray700, lineHeight: 20 },
  region: { gap: 6 },
  action: { minHeight: 44, justifyContent: 'center', gap: 4 },
  link: { color: DesignColors.primary, fontFamily: 'Manrope_600SemiBold' },
});
