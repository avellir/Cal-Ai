import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { BorderRadius, DesignColors, Spacing } from '@/constants/theme';
import { getAuthRedirectUrl } from '@/lib/linking';
import { useSessionStore } from '@/lib/session-store';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

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

      // Generate a deterministic UUID for dev sessions
      // This ensures the same provider always gets the same UUID
      const devUuid = provider === 'google'
        ? '00000000-0000-4000-8000-000000000001'  // Valid UUID v4 for Google
        : '00000000-0000-4000-8000-000000000002'; // Valid UUID v4 for Apple

      const mockSession = {
        access_token: `dev-${provider}-token-${now}`,
        refresh_token: `dev-${provider}-refresh-${now}`,
        token_type: 'bearer',
        provider_token: null,
        provider_refresh_token: null,
        expires_in: 3600,
        expires_at: now + 3600,
        user: {
          id: devUuid,
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
                  placeholderTextColor={DesignColors.gray400}
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
                    <ActivityIndicator size="small" color={DesignColors.white} />
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
                      placeholderTextColor={DesignColors.gray400}
                      style={styles.input}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      maxLength={6}
                      textContentType="oneTimeCode"
                      editable={!isVerifying}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyOtp}
                    />
                    <View style={styles.actions}>
                      <Text style={styles.socialHeading}>Or continue with</Text>
                      <OAuthButton
                        label="Sign in with Apple"
                        provider="apple"
                        activeProvider={activeProvider}
                        onPress={handleOAuthSignIn}>
                        {activeProvider === 'apple' ? (
                          <ActivityIndicator size="small" color={DesignColors.white} />
                        ) : (
                          <FontAwesome name="apple" size={22} color={DesignColors.white} />
                        )}
                      </OAuthButton>

                      <OAuthButton
                        label="Sign in with Google"
                        provider="google"
                        activeProvider={activeProvider}
                        onPress={handleOAuthSignIn}>
                        {activeProvider === 'google' ? (
                          <ActivityIndicator size="small" color={DesignColors.info} />
                        ) : (
                          <FontAwesome name="google" size={20} color={DesignColors.info} />
                        )}
                      </OAuthButton>
                    </View>
                  </View>
                ) : null}
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

        function OAuthButton({label, provider, activeProvider, onPress, children}: OAuthButtonProps) {
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
        backgroundColor: DesignColors.background,
  },
        flex: {
          flex: 1,
  },
        scrollContainer: {
          flexGrow: 1,
  },
        container: {
          flex: 1,
        paddingHorizontal: Spacing.xxl,
        paddingTop: 80,
  },
        title: {
          fontSize: 32,
        color: DesignColors.black,
        fontWeight: '600',
  },
        subtitle: {
          marginTop: Spacing.md,
        fontSize: 16,
        color: DesignColors.gray500,
  },
        emailCard: {
          marginTop: 40,
        backgroundColor: DesignColors.gray50,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        gap: Spacing.lg,
  },
        fieldLabel: {
          fontSize: 16,
        color: DesignColors.black,
        fontWeight: '500',
  },
        otpSection: {
          marginTop: Spacing.xxl,
        gap: Spacing.lg,
  },
        otpHint: {
          fontSize: 13,
        color: DesignColors.gray500,
  },
        input: {
          height: 52,
        borderRadius: 26,
        backgroundColor: DesignColors.white,
        paddingHorizontal: Spacing.xl,
        fontSize: 16,
        borderWidth: 1,
        borderColor: DesignColors.gray200,
  },
        ctaButton: {
          height: 56,
        borderRadius: 28,
        backgroundColor: DesignColors.black,
        alignItems: 'center',
        justifyContent: 'center',
  },
        ctaText: {
          color: DesignColors.white,
        fontSize: 17,
        fontWeight: '600',
  },
        successMessage: {
          marginTop: 4,
        fontSize: 14,
        color: DesignColors.success,
  },
        magicLinkHelper: {
          marginTop: 8,
        gap: 12,
  },
        magicLinkHeading: {
          fontSize: 16,
        color: DesignColors.black,
        fontWeight: '500',
  },
        magicLinkCopy: {
          fontSize: 14,
        color: DesignColors.gray500,
        lineHeight: 20,
  },
        secondaryButton: {
          alignSelf: 'flex-start',
        paddingHorizontal: 0,
        paddingVertical: 0,
  },
        secondaryText: {
          fontSize: 14,
        color: DesignColors.info,
        fontWeight: '500',
  },
        actions: {
          marginTop: 48,
        gap: 18,
  },
        socialHeading: {
          fontSize: 14,
        color: DesignColors.gray500,
        textAlign: 'center',
        letterSpacing: 0.5,
  },
        buttonBase: {
          height: 60,
        borderRadius: 30,
        justifyContent: 'center',
  },
        appleButton: {
          backgroundColor: DesignColors.black,
  },
        googleButton: {
          backgroundColor: DesignColors.white,
        borderWidth: 1,
        borderColor: DesignColors.black,
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
          color: DesignColors.white,
  },
        googleLabel: {
          color: DesignColors.black,
  },
  applePressed: {
    backgroundColor: DesignColors.black,
  },
  googlePressed: {
    backgroundColor: DesignColors.gray50,
  },
        buttonDisabled: {
          opacity: 0.7,
  },
});
