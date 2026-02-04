import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DesignColors } from '@/constants/theme';

type ParsedCallback = {
  params: Record<string, string>;
};

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function parseCallbackUrl(rawUrl: string): ParsedCallback {
  try {
    const parsed = new URL(rawUrl);
    const searchParams = Object.fromEntries(parsed.searchParams.entries());
    const fragment = parsed.hash?.startsWith('#') ? parsed.hash.slice(1) : parsed.hash ?? '';
    const fragmentParams = fragment
      ? Object.fromEntries(new URLSearchParams(fragment).entries())
      : {};

    return {
      params: {
        ...searchParams,
        ...fragmentParams,
      },
    };
  } catch (error) {
    console.warn('Failed to parse auth callback URL', { rawUrl, error });
    return { params: {} };
  }
}

function getDestinationPath(rawRedirect: string | null): string {
  if (!rawRedirect) {
    return '/';
  }

  if (rawRedirect.includes('://')) {
    // Ignore absolute targets to avoid navigating away from the client.
    return '/';
  }

  return rawRedirect.startsWith('/') ? rawRedirect : `/${rawRedirect}`;
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value ? EMAIL_OTP_TYPES.includes(value as EmailOtpType) : false;
}

function getParam(params: Record<string, string>, key: string): string | null {
  const value = params[key];
  return typeof value === 'string' && value.length ? value : null;
}

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const hasHandled = useRef(false);

  useEffect(() => {
    if (!url || hasHandled.current) {
      return;
    }

    hasHandled.current = true;
    let isMounted = true;

    const { params } = parseCallbackUrl(url);
    const accessToken = getParam(params, 'access_token');
    const refreshToken = getParam(params, 'refresh_token');
    const pkceCode = getParam(params, 'code');
    const tokenHash = getParam(params, 'token_hash');
    const possibleOtpType = getParam(params, 'type');

    if (!accessToken && !refreshToken && !pkceCode && !tokenHash) {
      console.warn('Auth callback missing recognizable credentials', { url, params });
    }

    const redirectOverride =
      getParam(params, 'redirect_to') ?? getParam(params, 'redirectTo') ?? null;
    const destination = getDestinationPath(redirectOverride);
    const otpType = isEmailOtpType(possibleOtpType) ? possibleOtpType : null;

    const exchangeSession = async () => {
      try {
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            throw setSessionError;
          }
        } else if (pkceCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(pkceCode);

          if (exchangeError) {
            throw exchangeError;
          }
        } else if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });

          if (verifyError) {
            throw verifyError;
          }
        } else {
          throw new Error('Missing auth parameters required to complete sign in.');
        }

        if (!isMounted) {
          return;
        }

        router.replace(destination as never);
      } catch (exchangeErr) {
        console.error('Supabase code exchange failed', exchangeErr);
        if (!isMounted) {
          return;
        }
        setError('We could not finish signing you in. Please try again.');
      }
    };

    exchangeSession();

    return () => {
      isMounted = false;
    };
  }, [router, url]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in failed</Text>
          <Text style={styles.message}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={styles.cta}>
            <Text style={styles.ctaText}>Return to app</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>Completing sign in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
    fontFamily: 'Manrope_600SemiBold',
    color: DesignColors.black,
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: DesignColors.gray500,
    marginTop: 12,
  },
  cta: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: DesignColors.primary,
  },
  ctaText: {
    color: DesignColors.white,
    fontFamily: 'Manrope_600SemiBold',
  },
});
