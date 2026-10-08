// Normalize spelling, not food identity: preparation and varieties stay distinct.
const WORD_ALIASES: Record<string, string> = {
  eggs: 'egg', tomatoes: 'tomato', potatoes: 'potato', peppers: 'pepper',
  carrots: 'carrot', onions: 'onion', cucumbers: 'cucumber', cheeses: 'cheese',
  strawberries: 'strawberry', blueberries: 'blueberry', raspberries: 'raspberry',
  almonds: 'almond', peanuts: 'peanut', walnuts: 'walnut', cashews: 'cashew',
  slices: 'slice', fillets: 'fillet', breasts: 'breast', thighs: 'thigh',
  chestnuts: 'chestnut', herbs: 'herb', whites: 'white', yolks: 'yolk',
};

export function normalizeFoodName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .map(word => WORD_ALIASES[word] ?? word).join(' ');
}

export function containsFoodPhrase(name: string, phrase: string): boolean {
  return ` ${normalizeFoodName(name)} `.includes(` ${normalizeFoodName(phrase)} `);
}

export function isBeverageName(name: string): boolean {
  const normalized = normalizeFoodName(name);
  // Beverage-derived solids and sauces must keep mass units.
  if (/\b(powder|bean|beans|leaves|milk chocolate|cake|bread|sauce|dressing|ice cream|chestnut)\b/.test(normalized)) {
    return false;
  }
  return /\b(juice|soda|water|coffee|tea|milk|smoothie|milkshake|shake|beer|wine|cocktail|mocktail|lemonade|drink|beverage)\b/.test(normalized);
}
