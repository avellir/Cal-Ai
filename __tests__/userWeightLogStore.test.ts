import { useUserWeightLogStore } from '@/store/userWeightLogStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string | null> = {};
  const getItem = jest.fn(async (key: string) => store[key] ?? null);
  const setItem = jest.fn(async (key: string, value: string) => {
    store[key] = value;
  });
  const clearStore = () => {
    Object.keys(store).forEach((k) => delete store[k]);
  };
  return {
    __esModule: true,
    default: { getItem, setItem },
    __store: { getItem, setItem, clearStore, store },
  };
});

const asyncMock = jest.requireMock('@react-native-async-storage/async-storage') as {
  __store: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    clearStore: () => void;
    store: Record<string, string | null>;
  };
};

const getLatestMock = jest.fn();
const addMock = jest.fn();

jest.mock('@/services/userWeightEntries', () => ({
  getLatestUserWeightEntry: (...args: unknown[]) => getLatestMock(...args),
  addUserWeightEntry: (...args: unknown[]) => addMock(...args),
}));

describe('userWeightLogStore', () => {
  beforeEach(() => {
    asyncMock.__store.clearStore();
    asyncMock.__store.getItem.mockClear();
    asyncMock.__store.setItem.mockClear();
    getLatestMock.mockReset();
    addMock.mockReset();
    useUserWeightLogStore.getState().clear();
    jest.clearAllMocks();
  });

  it('fetchLatest stores the latest entry', async () => {
    getLatestMock.mockResolvedValueOnce({
      data: {
        id: 'w1',
        userId: 'user-1',
        weightKg: 75.2,
        recordedAt: '2026-01-29T12:00:00.000Z',
        createdAt: '2026-01-29T12:00:00.000Z',
      },
      error: null,
    });

    await useUserWeightLogStore.getState().fetchLatest('user-1');

    const state = useUserWeightLogStore.getState();
    expect(state.latest?.id).toBe('w1');
    expect(state.latest?.weightKg).toBe(75.2);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(asyncMock.__store.setItem).toHaveBeenCalled();
  });

  it('addToday inserts and updates latest', async () => {
    addMock.mockResolvedValueOnce({
      data: {
        id: 'w2',
        userId: 'user-1',
        weightKg: 76,
        recordedAt: '2026-01-29T13:00:00.000Z',
        createdAt: '2026-01-29T13:00:00.000Z',
      },
      error: null,
    });

    const ok = await useUserWeightLogStore.getState().addToday('user-1', 76);
    expect(ok).toBe(true);
    expect(addMock).toHaveBeenCalledWith('user-1', 76, expect.any(Date));

    const state = useUserWeightLogStore.getState();
    expect(state.latest?.id).toBe('w2');
    expect(state.latest?.weightKg).toBe(76);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });
});

