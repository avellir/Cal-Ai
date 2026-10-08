import { supabase } from '@/lib/supabase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

type PhotoRequest = {
  mode: 'analyze' | 'refine' | 'label';
  base64Image: string;
  dishLabel?: string;
};

// All image entry points produce JPEG; no provider key is bundled in the app.
export async function convertImageToBase64(uri: string): Promise<string> {
  const image = await manipulateAsync(uri, [{ resize: { width: 1200 } }], {
    compress: 0.8, format: SaveFormat.JPEG, base64: true,
  });
  if (!image.base64) throw new Error('Could not read this photo. Please choose another image.');
  return image.base64;
}

export async function runPhotoAnalysis(request: PhotoRequest): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error('Please sign in again to analyze a photo.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100_000);
  try {
    const { data, error } = await supabase.functions.invoke('analyze-food', {
      body: request,
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    });
    if (error) {
      // Only display our function's messages, never raw provider errors or secrets.
      const context = error.context;
      if (context && typeof context.json === 'function') {
        const body = await context.json().catch(() => null);
        if (body?.error && typeof body.error === 'string') throw new Error(body.error);
        if (context.status === 401) throw new Error('Please sign in again to analyze a photo.');
        if (context.status === 404) throw new Error('Photo analysis is not deployed yet. Deploy the analyze-food function.');
      }
      throw new Error('Could not reach photo analysis. Check your connection and try again.');
    }
    if (!data?.result || typeof data.result !== 'object') throw new Error('Invalid photo analysis response.');
    return JSON.stringify(data.result);
  } finally {
    clearTimeout(timeout);
  }
}
