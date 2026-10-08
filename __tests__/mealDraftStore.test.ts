import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';
import type { AddMealInput } from '@/lib/meal-log-types';
import { useMealDraftStore } from '@/store/mealDraftStore';

const input: AddMealInput = { name: 'Bowl', calories: 500, macros: { protein: 30, carbs: 60, fat: 15 }, quantity: 1 };
const analysis: AdvancedAnalysisResult = {
  success: true,
  data: { totalNutrition: { calories: 500, protein: 30, carbs: 60, fat: 15 }, ingredients: [], regions: [], confidence: 85, warnings: ['Estimate'] },
};

beforeEach(() => useMealDraftStore.getState().reset());

it('preserves the original canonical analysis and identifies total overrides separately', () => {
  const id = useMealDraftStore.getState().createDraft('user-a', input, analysis);
  const edited = { ...input, calories: 600, quantity: 2 };
  expect(useMealDraftStore.getState().updateDraft('user-a', id, edited)).toBe(true);
  const draft = useMealDraftStore.getState().drafts[id];
  expect(draft.originalAnalysis).toEqual(analysis);
  expect(draft.originalAnalysis).not.toBe(analysis);
  expect(draft.input.calories).toBe(600);
  expect(draft.input.quantity).toBe(2);
  expect(draft.nutritionOverride).toEqual({ calories: 600, ...input.macros });
  expect(analysis.data!.totalNutrition.calories).toBe(500);
  expect(useMealDraftStore.getState().updateDraft('user-a', id, { ...input, quantity: 0.5 })).toBe(true);
  expect(useMealDraftStore.getState().drafts[id].nutritionOverride).toBeUndefined();
});

it('rejects another account editing or discarding a draft and clears previous drafts on a new owner', () => {
  const id = useMealDraftStore.getState().createDraft('user-a', input);
  expect(useMealDraftStore.getState().updateDraft('user-b', id, { ...input, name: 'Wrong account' })).toBe(false);
  useMealDraftStore.getState().discardDraft('user-b', id);
  expect(useMealDraftStore.getState().drafts[id]).toBeDefined();
  useMealDraftStore.getState().createDraft('user-b', input);
  expect(useMealDraftStore.getState().drafts[id]).toBeUndefined();
});

it('keeps the operation identity while editing, rejects invalid input, and discards only the requested draft', () => {
  const store = useMealDraftStore.getState();
  const first = store.createDraft('user-a', input);
  const second = store.createDraft('user-a', input);
  expect(first).not.toBe(second);
  expect(store.updateDraft('user-a', first, { ...input, quantity: 0 })).toBe(false);
  expect(store.updateDraft('user-a', first, { ...input, name: 'Updated' })).toBe(true);
  expect(useMealDraftStore.getState().drafts[first].id).toBe(first);
  store.discardDraft('user-a', first);
  expect(useMealDraftStore.getState().drafts[first]).toBeUndefined();
  expect(useMealDraftStore.getState().drafts[second]).toBeDefined();
});
