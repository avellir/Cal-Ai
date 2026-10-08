import { create } from 'zustand';

import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';
import type { MealDraft } from '@/lib/meal-draft-types';
import type { AddMealInput } from '@/lib/meal-log-types';
import { getMealInputError } from '@/services/mealValidation';

type MealDraftState = {
  ownerId: string | null;
  drafts: Record<string, MealDraft>;
  createDraft: (userId: string, input: AddMealInput, analysis?: AdvancedAnalysisResult) => string;
  updateDraft: (userId: string, draftId: string, input: AddMealInput) => boolean;
  discardDraft: (userId: string, draftId: string) => void;
  reset: () => void;
};

let sequence = 0;

export const useMealDraftStore = create<MealDraftState>((set, get) => ({
  ownerId: null,
  drafts: {},
  createDraft: (userId, input, analysis) => {
    if (!userId) throw new Error('Sign in to review a meal.');
    const error = getMealInputError(input);
    if (error) throw new Error(error);
    const id = `meal-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
    const originalAnalysis = analysis ? JSON.parse(JSON.stringify(analysis)) as AdvancedAnalysisResult : undefined;
    const draft: MealDraft = { version: 1, id, userId, input: { ...input, macros: { ...input.macros } }, originalAnalysis };
    set(state => ({ ownerId: userId, drafts: { ...(state.ownerId === userId ? state.drafts : {}), [id]: draft } }));
    return id;
  },
  updateDraft: (userId, draftId, input) => {
    const state = get();
    const draft = state.drafts[draftId];
    if (state.ownerId !== userId || !draft || draft.userId !== userId || getMealInputError(input)) return false;
    const original = draft.originalAnalysis?.data?.totalNutrition;
    const edited = original && (original.calories !== input.calories || original.protein !== input.macros.protein ||
      original.carbs !== input.macros.carbs || original.fat !== input.macros.fat);
    set({ drafts: { ...state.drafts, [draftId]: {
      ...draft,
      input: { ...input, macros: { ...input.macros } },
      nutritionOverride: edited ? { calories: input.calories, ...input.macros } : undefined,
    } } });
    return true;
  },
  discardDraft: (userId, draftId) => {
    if (get().ownerId !== userId) return;
    set(state => {
      const drafts = { ...state.drafts };
      delete drafts[draftId];
      return { drafts };
    });
  },
  reset: () => set({ ownerId: null, drafts: {} }),
}));
