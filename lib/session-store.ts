import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { useMealDraftStore } from '@/store/mealDraftStore';

type SessionStatus = 'loading' | 'ready';

type SessionState = {
  session: Session | null;
  status: SessionStatus;
  setSession: (session: Session | null) => void;
  setStatus: (status: SessionStatus) => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  status: 'loading',
  setSession: (session) => {
    if (get().session?.user.id !== session?.user.id) useMealDraftStore.getState().reset();
    set({ session });
  },
  setStatus: (status) => set({ status }),
}));

let bootstrapPromise: Promise<void> | null = null;
let unsubscribe: (() => void) | null = null;

export const bootstrapSession = () => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const { setSession, setStatus } = useSessionStore.getState();

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Failed to fetch Supabase session', error);
      }

      setSession(session ?? null);
    } catch (error) {
      console.error('Unexpected error during session bootstrap', error);
    } finally {
      setStatus('ready');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      useSessionStore.getState().setSession(session ?? null);
      useSessionStore.setState({ status: 'ready' });
    });

    unsubscribe = () => subscription.unsubscribe();
  })();

  return bootstrapPromise;
};

export const cleanupSession = () => {
  useMealDraftStore.getState().reset();
  unsubscribe?.();
  unsubscribe = null;
  bootstrapPromise = null;
  useSessionStore.setState({ session: null, status: 'loading' });
};
