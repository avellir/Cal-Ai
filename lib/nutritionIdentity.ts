import type { NutritionFoodContext } from '@/lib/nutrition-types';

/** Family ambiguity is different from an unknown brand, recipe or minor subtype. */
export function requiresIdentityConfirmation(query: string, context: Pick<NutritionFoodContext,
  'foodName' | 'dishName' | 'visualEvidence' | 'identityUncertain' | 'identityAlternatives' | 'nutritionIdentityKnown'> = {}): boolean {
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const name = normalize(context.foodName || query);
  const alternatives = (context.identityAlternatives ?? []).map(normalize);
  if (/\b(cocktail|mocktail|mixed drink|unidentified|unknown|protein|meat topping)\b/.test(name)) return true;
  const proteins = ['tofu|tempeh|soy', 'chicken|poultry', 'beef', 'pork', 'fish|salmon|tuna', 'shrimp|prawn'];
  const familyCount = proteins.filter(group => [name, ...alternatives].some(text => new RegExp(`\\b(${group})\\b`).test(text))).length;
  if (familyCount > 1) return true;
  for (const groups of [['cheesecake', 'custard|tart|pastry|pie'], ['ice cream', 'sorbet', 'frozen yogurt']]) {
    if (groups.filter(group => [name, ...alternatives].some(text => new RegExp(`\\b(${group})\\b`).test(text))).length > 1) return true;
  }
  if (/\begg/.test(name)) {
    const types = ['quail', 'chicken', 'duck'].filter(type => [name, ...alternatives].some(text => new RegExp(`\\b${type}\\b`).test(text)));
    if (types.length > 1 || types.length === 0 && context.identityUncertain === true) return true;
  }
  if (/^(sauce|dressing)$/.test(name)) {
    const evidence = normalize(`${context.dishName ?? ''} ${context.visualEvidence ?? ''}`);
    return !/\b(cream|creamy|tomato|soy|tahini|yogurt|vinaigrette|mayonnaise|pesto)\b/.test(evidence);
  }
  return false;
}
