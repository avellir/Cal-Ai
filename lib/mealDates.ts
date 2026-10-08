/** Local calendar dates are not UTC dates or fixed 24-hour intervals. */
export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return year >= 1000 && getLocalDateKey(date) === value ? date : null;
}

export function getLocalDayBounds(date: Date): { start: number; end: number } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function getDiaryDates(todayKey: string, selectedKey: string, days = 7): Date[] {
  const today = parseLocalDateKey(todayKey);
  if (!today) return [];
  const dates: Date[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    dates.push(date);
  }
  const selected = parseLocalDateKey(selectedKey);
  if (selected && !dates.some(date => getLocalDateKey(date) === selectedKey)) {
    dates.push(selected);
    dates.sort((a, b) => a.getTime() - b.getTime());
  }
  return dates;
}

/** null selection means follow today; explicit historical dates stay selected. */
export function resolveDiaryDate(selectedKey: string | null, todayKey: string): string {
  return selectedKey && parseLocalDateKey(selectedKey) ? selectedKey : todayKey;
}
