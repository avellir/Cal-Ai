import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { supabase } from '@/lib/supabase';
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, functions: { invoke: jest.fn() } } }));
const session = supabase.auth.getSession as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;
beforeEach(() => {
  session.mockResolvedValue({ data: { session: { access_token: 'user-token' } }, error: null });
  invoke.mockResolvedValue({ data: { result: { regions: [], overallConfidence: 90 } }, error: null });
});
it('calls the named function using the user session and preserves the response shape', async () => {
  const result = await runPhotoAnalysis({ mode: 'analyze', base64Image: '/9j/AAAA' });
  expect(JSON.parse(result)).toEqual({ regions: [], overallConfidence: 90 });
  expect(invoke).toHaveBeenCalledWith('analyze-food', expect.objectContaining({
    headers: { Authorization: 'Bearer user-token' }, body: { mode: 'analyze', base64Image: '/9j/AAAA' },
  }));
});
it('requires sign-in without invoking the function', async () => {
  session.mockResolvedValue({ data: { session: null }, error: null });
  await expect(runPhotoAnalysis({ mode: 'label', base64Image: 'photo' })).rejects.toThrow('sign in');
  expect(invoke).not.toHaveBeenCalled();
});
it('surfaces a server error and never automatically retries', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'Photo analysis is busy.' }), { status: 429 }) } });
  await expect(runPhotoAnalysis({ mode: 'analyze', base64Image: 'photo' })).rejects.toThrow('busy');
  expect(invoke).toHaveBeenCalledTimes(1);
});
