import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getLocalDateKey, getLocalDayBounds, resolveDiaryDate } from '@/lib/mealDates';

export function useDiaryDate(initialDateKey?: string) {
  const [clock, setClock] = useState(() => new Date());
  const todayKey = getLocalDateKey(clock);
  const [selection, setSelection] = useState<string | null>(() =>
    initialDateKey && initialDateKey !== getLocalDateKey() ? initialDateKey : null
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, Math.max(1, getLocalDayBounds(new Date()).end - Date.now() + 50));
    };
    const refresh = () => {
      setClock(new Date());
      scheduleMidnight();
    };
    scheduleMidnight();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return {
    clock,
    todayKey,
    selectedDateKey: resolveDiaryDate(selection, todayKey),
    selectDate: (key: string) => setSelection(key === getLocalDateKey() ? null : key),
  };
}
