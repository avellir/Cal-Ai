// Node.js 25+ has localStorage in global scope but requires --localstorage-file flag
// We need to remove it to prevent SecurityError in tests
// @ts-expect-error - Intentionally removing localStorage from global
delete globalThis.localStorage;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
      },
    },
    manifest: null,
  },
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file://compressed-image.jpg',
    width: 800,
    height: 600,
  }),
}));
