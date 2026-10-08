import type { Session } from '@supabase/supabase-js';
import { useSessionStore } from '@/lib/session-store';
import { useMealDraftStore } from '@/store/mealDraftStore';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));

const session = (id: string, token = 'first'): Session => ({
  user: { id }, access_token: token,
} as Session);
const input = { name: 'Bowl', calories: 500, macros: { protein: 30, carbs: 60, fat: 15 } };

beforeEach(() => {
  useSessionStore.getState().setSession(null);
  useMealDraftStore.getState().reset();
});

it('keeps a draft when the same account refreshes its session', () => {
  useSessionStore.getState().setSession(session('user-a'));
  const id = useMealDraftStore.getState().createDraft('user-a', input);
  useSessionStore.getState().setSession(session('user-a', 'refreshed'));
  expect(useMealDraftStore.getState().drafts[id]).toBeDefined();
});

it.each([null, session('user-b')])('clears drafts when the authenticated identity changes to %j', next => {
  useSessionStore.getState().setSession(session('user-a'));
  useMealDraftStore.getState().createDraft('user-a', input);
  useSessionStore.getState().setSession(next);
  expect(useMealDraftStore.getState().drafts).toEqual({});
  expect(useMealDraftStore.getState().ownerId).toBeNull();
});
