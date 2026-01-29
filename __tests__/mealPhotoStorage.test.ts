jest.mock('@/lib/supabase', () => {
  const createSignedUrl = jest.fn();
  const remove = jest.fn();
  const from = jest.fn(() => ({
    // Only the methods used by the meal photo storage service need to be mocked
    createSignedUrl,
    remove,
  }));

  return {
    supabase: {
      storage: {
        from,
      },
    },
    __mock: { createSignedUrl, remove, from },
  };
});

import { deleteMealPhoto, generateStoragePath, getSignedPhotoUrl } from '@/services/mealPhotoStorage';

// Access the mock handles exposed by the jest mock factory
const { __mock } = jest.requireMock('@/lib/supabase') as {
  __mock: {
    createSignedUrl: jest.Mock;
    remove: jest.Mock;
    from: jest.Mock;
  };
};

describe('mealPhotoStorage', () => {
  beforeEach(() => {
    __mock.createSignedUrl.mockReset();
    __mock.remove.mockReset();
    __mock.from.mockClear();
  });

  describe('generateStoragePath (Property 1: correct path pattern)', () => {
    it('builds {profileId}/{mealId}.{ext} and strips leading dot', () => {
      const path = generateStoragePath('profile-123', 'meal-456', '.png');
      expect(path).toBe('profile-123/meal-456.png');
    });
  });

  describe('getSignedPhotoUrl (Property 7: signed URL contains expiration)', () => {
    it('uses the default 1-hour expiration and returns the signed URL', async () => {
      __mock.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/image.png?token=abc' },
        error: null,
      });

      const url = await getSignedPhotoUrl('user-1/meal-1.png');

      expect(__mock.from).toHaveBeenCalledWith('meal-photos');
      expect(__mock.createSignedUrl).toHaveBeenCalledWith('user-1/meal-1.png', 3600);
      expect(url).toBe('https://example.com/image.png?token=abc');
    });

    it('respects a custom expiration override', async () => {
      __mock.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/image.png?token=abc&exp=120' },
        error: null,
      });

      await getSignedPhotoUrl('user-1/meal-1.png', 120);

      expect(__mock.createSignedUrl).toHaveBeenCalledWith('user-1/meal-1.png', 120);
    });

    it('returns null when Supabase returns an error', async () => {
      __mock.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'failed to sign' },
      });

      const url = await getSignedPhotoUrl('user-1/meal-1.png');

      expect(url).toBeNull();
    });
  });

  describe('deleteMealPhoto (Property 3: deletion removes storage file)', () => {
    it('attempts to delete all common extensions for a meal', async () => {
      __mock.remove.mockResolvedValue({ data: null, error: null });

      await deleteMealPhoto('profile-123', 'meal-456');

      expect(__mock.from).toHaveBeenCalledWith('meal-photos');
      expect(__mock.remove).toHaveBeenCalledWith([
        'profile-123/meal-456.jpg',
        'profile-123/meal-456.png',
        'profile-123/meal-456.webp',
      ]);
    });

    it('does not throw when Supabase returns a deletion error', async () => {
      __mock.remove.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(deleteMealPhoto('profile-123', 'meal-456')).resolves.toBeUndefined();
    });
  });
});
