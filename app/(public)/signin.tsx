import { type ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

import type { Session } from '@supabase/supabase-js';
import { useSessionStore } from '@/lib/session-store';
import { supabase } from '@/lib/supabase';
import { getAuthRedirectUrl } from '@/lib/linking';

type Provider = 'google' | 'apple';

export default function SignInScreen() {
  const router = useRouter();
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState<string | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const setSession = useSessionStore((state) => state.setSession);
  const setStatus = useSessionStore((state) => state.setStatus);

  const handleOAuthSignIn = useCallback(
    (provider: Provider) => {
      if (activeProvider) {
        return;
      }

      setActiveProvider(provider);
      const now = Math.floor(Date.now() / 1000);
      const mockSession = {
        access_token: `dev-${provider}-token`,
        refresh_token: `dev-${provider}-refresh`,
        token_type: 'bearer',
        provider_token: null,
        provider_refresh_token: null,
        expires_in: 3600,
        expires_at: now + 3600,
        user: {
          id: `dev-${provider}-user`,
          aud: 'authenticated',
          role: 'authenticated',
          email: `${provider}@example.com`,
          email_confirmed_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: { provider },
          user_metadata: { provider },
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          factors: [],
          is_anonymous: false,
        },
      } as unknown as Session;

      setTimeout(() => {
        setSession(mockSession);
        setStatus('ready');
        setActiveProvider(null);
        router.replace('/');
      }, 650);
    },
    [activeProvider, router, setSession, setStatus]
  );

  const handleEmailSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email required', 'Enter your email to receive a magic link.');
      return;
    }

    setIsEmailSubmitting(true);
    setEmailSubmitted(false);
    setOtpCode('');
    setShowOtpFallback(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }

      setEmailForOtp(trimmedEmail);
      setEmailSubmitted(true);
    } catch (err) {
      console.error('Email sign-in failed', err);
      Alert.alert(
        'Unable to send link',
        'Something went wrong sending the link. Please try again shortly.'
      );
    } finally {
      setIsEmailSubmitting(false);
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    const targetEmail = emailForOtp;
    const trimmedCode = otpCode.trim();

    if (!targetEmail) {
      Alert.alert('Email required', 'Enter your email first to receive the code.');
      return;
    }

    if (trimmedCode.length < 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: trimmedCode,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      setSession(data.session ?? null);
      setStatus('ready');
      router.replace('/');
    } catch (err) {
      console.error('OTP verification failed', err);
      Alert.alert('Verification failed', 'Double-check your code and try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [emailForOtp, otpCode, router, setSession, setStatus]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
              <Text style={styles.title}>Create an account</Text>
              <Text style={styles.subtitle}>
                Sign in to continue tracking your progress with Cal AI.
              </Text>

              <View style={styles.emailCard}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  editable={!isEmailSubmitting && !emailSubmitted}
                  returnKeyType="done"
                  onSubmitEditing={handleEmailSignIn}
                />
                <Pressable
                  style={[
                    styles.ctaButton,
                    (isEmailSubmitting || emailSubmitted) && styles.buttonDisabled,
                  ]}
                  disabled={isEmailSubmitting || emailSubmitted}
                  onPress={handleEmailSignIn}>
                  {isEmailSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.ctaText}>Send sign-in link</Text>
                  )}
                </Pressable>
                {emailSubmitted ? (
                  <Text style={styles.successMessage}>
                    Email sent! Tap the magic link we sent to {emailForOtp ?? 'your email'} or enter
                    the 6-digit code below if it appears in the message.
                  </Text>
                ) : null}
                {emailSubmitted ? (
                  <View style={styles.magicLinkHelper}>
                    <Text style={styles.magicLinkHeading}>Check your inbox</Text>
                    <Text style={styles.magicLinkCopy}>
                      Tap the magic link to finish signing in. If your email app shows a 6-digit code
                      instead, you can enter it manually below.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowOtpFallback((prev) => !prev)}
                      style={styles.secondaryButton}>
                      <Text style={styles.secondaryText}>
                        {showOtpFallback ? 'Hide code entry' : 'Enter code manually'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {emailSubmitted && showOtpFallback ? (
                  <View style={styles.otpSection}>
                    <Text style={styles.fieldLabel}>Verification code</Text>
                    <Text style={styles.otpHint}>
                      The code is 6 digits long and is included in the same email as the magic link.
                    </Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      placeholder="123456"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      maxLength={6}
                      textContentType="oneTimeCode"
                      editable={!isVerifying}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyOtp}
                    />
                    <Pressable
                      style={[styles.ctaButton, isVerifying && styles.buttonDisabled]}
                      disabled={isVerifying}
                      onPress={handleVerifyOtp}>
                      {isVerifying ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.ctaText}>Verify code</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.actions}>
                <Text style={styles.socialHeading}>Or continue with</Text>
                <OAuthButton
                  label="Sign in with Apple"
                  provider="apple"
                  activeProvider={activeProvider}
                  onPress={handleOAuthSignIn}>
                  {activeProvider === 'apple' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome name="apple" size={22} color="#FFFFFF" />
                  )}
                </OAuthButton>

                <OAuthButton
                  label="Sign in with Google"
                  provider="google"
                  activeProvider={activeProvider}
                  onPress={handleOAuthSignIn}>
                  {activeProvider === 'google' ? (
                    <ActivityIndicator size="small" color="#1A73E8" />
                  ) : (
                    <FontAwesome name="google" size={20} color="#1A73E8" />
                  )}
                </OAuthButton>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type OAuthButtonProps = {
  label: string;
  provider: Provider;
  activeProvider: Provider | null;
  onPress: (provider: Provider) => void;
  children: ReactNode;
};

function OAuthButton({ label, provider, activeProvider, onPress, children }: OAuthButtonProps) {
  const isActive = activeProvider === provider;
  const isApple = provider === 'apple';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={Boolean(activeProvider && !isActive)}
      onPress={() => onPress(provider)}
      style={({ pressed }) => [
        styles.buttonBase,
        isApple ? styles.appleButton : styles.googleButton,
        pressed && !isActive && (isApple ? styles.applePressed : styles.googlePressed),
        isActive && styles.buttonDisabled,
      ]}>
      <View style={styles.buttonContent}>
        <View style={styles.iconHolder}>{children}</View>
        <Text style={[styles.buttonLabel, isApple ? styles.appleLabel : styles.googleLabel]}>
          {label}
        </Text>
        <View style={styles.iconHolder} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    color: '#11181C',
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emailCard: {
    marginTop: 40,
    backgroundColor: '#F5F5F7',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '500',
  },
  otpSection: {
    marginTop: 24,
    gap: 16,
  },
  otpHint: {
    fontSize: 13,
    color: '#6B7280',
  },
  input: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ctaButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#11181C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  successMessage: {
    marginTop: 4,
    fontSize: 14,
    color: '#059669',
  },
  magicLinkHelper: {
    marginTop: 8,
    gap: 12,
  },
  magicLinkHeading: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '500',
  },
  magicLinkCopy: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  secondaryText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  actions: {
    marginTop: 48,
    gap: 18,
  },
  socialHeading: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  buttonBase: {
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#11181C',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  iconHolder: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  appleLabel: {
    color: '#FFFFFF',
  },
  googleLabel: {
    color: '#11181C',
  },
  applePressed: {
    backgroundColor: '#111111',
  },
  googlePressed: {
    backgroundColor: '#F9FAFB',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
