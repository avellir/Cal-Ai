import { containsFoodPhrase, normalizeFoodName } from '@/services/foodNames';

/**
 * Small, offline nutrition reference used while the external provider is disabled.
 * Values are approximate per 100 g. Unknown foods use a generic estimate and
 * are marked separately so the result can warn the user.
 */
type NutritionPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
};

export type NutritionLookupResult = {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  servingUnit: string;
  scaledNutrition: NutritionPer100g;
  source: 'estimated' | 'generic';
  confidencePenalty: number;
};

const REFERENCE: Record<string, NutritionPer100g> = {
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'chicken thigh': { calories: 209, protein: 26, carbs: 0, fat: 10.9 },
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'ground beef': { calories: 250, protein: 26, carbs: 0, fat: 15 },
  beef: { calories: 250, protein: 26, carbs: 0, fat: 15 },
  pork: { calories: 242, protein: 27, carbs: 0, fat: 14 },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13 },
  tuna: { calories: 144, protein: 23, carbs: 0, fat: 5 },
  shrimp: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  egg: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  // USDA SR28 NDB 01132; recipe average, not a measured recipe for the photo.
  'scrambled egg': { calories: 149, protein: 9.99, carbs: 1.61, fat: 10.98 },
  tofu: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  'white rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  'brown rice': { calories: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  pasta: { calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  potato: { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  'sweet potato': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  quinoa: { calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  oats: { calories: 389, protein: 17, carbs: 66, fat: 6.9 },
  broccoli: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  carrot: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  'bell pepper': { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  pepper: { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  onion: { calories: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  tomato: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  lettuce: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  spinach: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  cucumber: { calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 },
  zucchini: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  mushroom: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  corn: { calories: 86, protein: 3.3, carbs: 19, fat: 1.4 },
  peas: { calories: 81, protein: 5, carbs: 14, fat: 0.4 },
  'green beans': { calories: 31, protein: 1.8, carbs: 7, fat: 0.2 },
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  banana: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  orange: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  strawberry: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  blueberry: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  avocado: { calories: 160, protein: 2, carbs: 8.5, fat: 15 },
  milk: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  'cheddar cheese': { calories: 402, protein: 25, carbs: 1.3, fat: 33 },
  cheese: { calories: 402, protein: 25, carbs: 1.3, fat: 33 },
  mozzarella: { calories: 280, protein: 28, carbs: 3.1, fat: 17 },
  // USDA SR28 NDB 01033, hard Parmesan.
  parmesan: { calories: 392, protein: 35.75, carbs: 3.22, fat: 25.83 },
  yogurt: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  butter: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  'olive oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'vegetable oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  oil: { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'coconut oil': { calories: 862, protein: 0, carbs: 0, fat: 100 },
  'soy sauce': { calories: 53, protein: 5.6, carbs: 4.9, fat: 0.1 },
  ketchup: { calories: 112, protein: 1.2, carbs: 27, fat: 0.1 },
  mayonnaise: { calories: 680, protein: 1, carbs: 0.6, fat: 75 },
  mustard: { calories: 66, protein: 4, carbs: 6, fat: 4 },
  'hot sauce': { calories: 12, protein: 0.9, carbs: 2.1, fat: 0.3 },
  hummus: { calories: 166, protein: 8, carbs: 14, fat: 10 },
  guacamole: { calories: 150, protein: 2, carbs: 9, fat: 13 },
  salsa: { calories: 36, protein: 1.5, carbs: 7, fat: 0.2 },
  'ranch dressing': { calories: 458, protein: 1.4, carbs: 5.5, fat: 48 },
  'caesar dressing': { calories: 420, protein: 2.5, carbs: 4, fat: 44 },
  vinaigrette: { calories: 267, protein: 0.1, carbs: 6, fat: 28 },
  'bbq sauce': { calories: 172, protein: 0, carbs: 41, fat: 0.5 },
  'teriyaki sauce': { calories: 89, protein: 5.7, carbs: 15, fat: 0.1 },
  pesto: { calories: 420, protein: 5, carbs: 5, fat: 42 },
  tahini: { calories: 595, protein: 17, carbs: 21, fat: 54 },
  'cream cheese': { calories: 342, protein: 6, carbs: 5.5, fat: 34 },
  almond: { calories: 579, protein: 21, carbs: 22, fat: 50 },
  peanut: { calories: 567, protein: 26, carbs: 16, fat: 49 },
  walnut: { calories: 654, protein: 15, carbs: 14, fat: 65 },
  cashew: { calories: 553, protein: 18, carbs: 30, fat: 44 },
  'black beans': { calories: 132, protein: 8.9, carbs: 24, fat: 0.5 },
  'kidney beans': { calories: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  chickpeas: { calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  lentils: { calories: 116, protein: 9, carbs: 20, fat: 0.4 },
};

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  piece: 100,
  pieces: 100,
  serving: 100,
  servings: 100,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

const GENERIC_ESTIMATE: NutritionPer100g = { calories: 100, protein: 5, carbs: 15, fat: 3 };
const ALIASES: Record<string, string> = {
  'green bean': 'green beans',
  cheeses: 'cheese',
  eggs: 'egg',
  oat: 'oats',
  penne: 'pasta',
  spaghetti: 'pasta',
  macaroni: 'pasta',
  fusilli: 'pasta',
  sourdough: 'bread',
  toast: 'bread',
  'parmesan cheese': 'parmesan',
};

const REFERENCE_KEYS = Object.keys(REFERENCE).sort((a, b) => b.length - a.length || a.localeCompare(b));
const COMPOSITE_WORDS = /\b(juice|sauce|dressing|soup|broth|cake|cheesecake|pizza|pie|sandwich|salad|smoothie|shake|ice cream|chocolate|powder|dried|dry)\b/g;

function findNutritionReference(name: string): string | undefined {
  const normalized = normalizeFoodName(name);
  const canonical = ALIASES[normalized] ?? normalized;
  if (REFERENCE[canonical]) return canonical;
  if (/\b(raw|uncooked|dry)\b/.test(canonical) && /\b(pasta|penne|spaghetti|rice|quinoa|chickpeas|lentils)\b/.test(canonical)) return undefined;
  if (/\bcooked\b/.test(canonical) && /\boats\b/.test(canonical)) return undefined;
  if (/\b(and|with)\b/.test(canonical)) return undefined;
  // These variants have materially different nutrition from their base food.
  if (/\b(coconut|almond|soy|oat|cashew|rice|chocolate|skim|skimmed) milk\b/.test(canonical) ||
    /\begg (white|yolk)\b/.test(canonical) || /\b(black|white) pepper\b/.test(canonical) ||
    /\b(peanut|almond|cashew|nut) butter\b/.test(canonical) ||
    (/\bfried\b/.test(canonical) && /\b(chicken|potato|rice)\b/.test(canonical))) return undefined;
  // A named dish or altered food cannot borrow the nutrition of one component.
  // E.g. orange juice != orange, chicken soup != chicken, milk powder != milk.
  const qualifiers = canonical.match(COMPOSITE_WORDS) ?? [];
  return REFERENCE_KEYS.find(key => containsFoodPhrase(canonical, key) &&
    qualifiers.every(qualifier => containsFoodPhrase(key, qualifier)));
}

export function lookupIngredientNutrition(ingredient: Ingredient): NutritionLookupResult {
  if (!ingredient.name.trim() || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
    throw new Error('A food name and positive finite portion are required for nutrition lookup.');
  }
  const conversion = UNIT_TO_GRAMS[ingredient.unit.toLowerCase().trim()];
  if (conversion === undefined) throw new Error(`Unsupported nutrition unit: ${ingredient.unit}`);
  const match = findNutritionReference(ingredient.name);
  const isKnown = Boolean(match);
  const reference = match ? REFERENCE[match] : GENERIC_ESTIMATE;
  const grams = ingredient.quantity * conversion;
  const scale = grams / 100;
  const scaledNutrition = {
    calories: Math.round(reference.calories * scale),
    protein: Math.round(reference.protein * scale * 10) / 10,
    carbs: Math.round(reference.carbs * scale * 10) / 10,
    fat: Math.round(reference.fat * scale * 10) / 10,
  };

  return {
    foodId: isKnown ? `local:${match}` : 'generic_estimate',
    foodName: ingredient.name,
    ...reference,
    servingSize: '100 g',
    servingUnit: 'g',
    scaledNutrition,
    source: isKnown ? 'estimated' : 'generic',
    confidencePenalty: isKnown ? 10 : 20,
  };
}
