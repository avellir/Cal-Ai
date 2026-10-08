import { getDiaryDates, getLocalDateKey, getLocalDayBounds, parseLocalDateKey, resolveDiaryDate } from '@/lib/mealDates';
import type { MealLogEntry } from '@/lib/meal-log-types';
import { aggregateDailyNutrition, getMealsForDate } from '@/services/nutritionAggregation';

const meal = (id: string, date: Date, calories: number): MealLogEntry => ({
  id, name: id, timestamp: date.getTime(), calories,
  macros: { protein: calories / 10, carbs: calories / 5, fat: calories / 20 },
  mealType: 'lunch',
});

describe('selected-day tracking', () => {
  const today = new Date(2026, 9, 1);
  const yesterday = new Date(2026, 8, 30);
  const meals = [meal('today', new Date(2026, 9, 1, 12), 400), meal('yesterday', new Date(2026, 8, 30, 12), 600)];

  it('changes both diary meals and totals with the selected day', () => {
    expect(getMealsForDate(meals, today).map(entry => entry.id)).toEqual(['today']);
    expect(aggregateDailyNutrition(meals, today)).toEqual({ calories: 400, protein: 40, carbs: 80, fat: 20 });
    expect(getMealsForDate(meals, yesterday).map(entry => entry.id)).toEqual(['yesterday']);
    expect(aggregateDailyNutrition(meals, yesterday).calories).toBe(600);
  });

  it('includes local midnight and excludes the next midnight, newest first', () => {
    const entries = [
      meal('start', today, 100), meal('end', new Date(2026, 9, 2), 800),
      meal('late', new Date(2026, 9, 1, 23, 59, 59, 999), 200),
    ];
    expect(getMealsForDate(entries, today).map(entry => entry.id)).toEqual(['late', 'start']);
    expect(aggregateDailyNutrition(entries, today).calories).toBe(300);
  });

  it('returns zero intake for an empty day and defaults to today for existing callers', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 1, 14));
    try {
      expect(aggregateDailyNutrition(meals).calories).toBe(400);
      expect(aggregateDailyNutrition(meals, new Date(2026, 9, 3))).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    } finally { jest.useRealTimers(); }
  });

  it('follows today across midnight but preserves an explicit historical selection', () => {
    expect(resolveDiaryDate(null, '2026-10-02')).toBe('2026-10-02');
    expect(resolveDiaryDate('2026-09-25', '2026-10-02')).toBe('2026-09-25');
    expect(getDiaryDates('2026-10-02', '2026-09-25').map(getLocalDateKey)).toContain('2026-09-25');
  });

  it('parses calendar dates locally and rejects impossible dates', () => {
    expect(getLocalDateKey(parseLocalDateKey('2024-02-29')!)).toBe('2024-02-29');
    expect(parseLocalDateKey('2026-02-29')).toBeNull();
    expect(parseLocalDateKey('2026-13-01')).toBeNull();
    expect(parseLocalDateKey('2026-10-01T00:00:00Z')).toBeNull();
  });

  it.each([new Date(2026, 2, 8), new Date(2026, 10, 1), new Date(2026, 2, 29), new Date(2026, 9, 25)])(
    'uses consecutive local midnights across timezone offset changes (%s)', date => {
      const { start, end } = getLocalDayBounds(date);
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      expect(end).toBe(next.getTime());
      expect(new Date(start).getHours()).toBe(0);
      expect(getMealsForDate([meal('last', new Date(end - 1), 1), meal('next', next, 2)], date).map(entry => entry.id)).toEqual(['last']);
    }
  );
});
