import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, DesignColors, Spacing } from '@/constants/theme';
import { getAuthRedirectUrl } from '@/lib/linking';
import { useSessionStore } from '@/lib/session-store';
import { supabase } from '@/lib/supabase';
export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState<string | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const setSession = useSessionStore((state) => state.setSession);
  const setStatus = useSessionStore((state) => state.setStatus);
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
    }
    catch (err) {
      console.error('Email sign-in failed', err);
      Alert.alert('Unable to send link', 'Something went wrong sending the link. Please try again shortly.');
    }
    finally {
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
    if (!/^\d{6}$/.test(trimmedCode)) {
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
      if (!data.session)
        throw new Error('No authenticated session returned');
      setSession(data.session ?? null);
      setStatus('ready');
      router.replace('/');
    }
    catch (err) {
      console.error('OTP verification failed', err);
      Alert.alert('Verification failed', 'Double-check your code and try again.');
    }
    finally {
      setIsVerifying(false);
    }
  }, [emailForOtp, otpCode, router, setSession, setStatus]);
  return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
   <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
     <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
       <Text style={styles.title}>{emailSubmitted ? 'Check your inbox' : 'Welcome to Cal AI'}</Text>
       <Text style={styles.subtitle}>
        Sign in or create an account to track your meals and progress.
       </Text>

       <View style={styles.emailCard}>
        {!emailSubmitted ? <>
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={DesignColors.gray400} style={styles.input} value={email} onChangeText={setEmail} editable={!isEmailSubmitting && !emailSubmitted} returnKeyType="done" onSubmitEditing={handleEmailSignIn}/>
        <Pressable style={[
        styles.ctaButton,
        (isEmailSubmitting || emailSubmitted) && styles.buttonDisabled,
      ]} disabled={isEmailSubmitting || emailSubmitted} onPress={handleEmailSignIn}>
         {isEmailSubmitting ? (<ActivityIndicator size="small" color={DesignColors.white}/>) : (<Text style={styles.ctaText}>Send sign-in link</Text>)}
        </Pressable>
        <Text style={styles.magicLinkCopy}>We’ll email you a sign-in link. No password needed.</Text>
        </> : null}
        {emailSubmitted ? (<Text style={styles.successMessage}>
          Email sent to {emailForOtp ?? 'your email'}.
         </Text>) : null}
        {emailSubmitted ? (<View style={styles.magicLinkHelper}>
          <Text style={styles.magicLinkCopy}>
           Open the email and tap the sign-in link to return to Cal AI.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setShowOtpFallback((prev) => !prev)} style={styles.secondaryButton}>
           <Text style={styles.secondaryText}>
            {showOtpFallback ? 'Hide code entry' : 'Enter code manually'}
           </Text>
          </Pressable>
         </View>) : null}
        {emailSubmitted && showOtpFallback ? (<View style={styles.otpSection}>
          <Text style={styles.fieldLabel}>Verification code</Text>
          <Text style={styles.otpHint}>
           If your email includes a 6-digit code, enter it here.
          </Text>
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="number-pad" placeholder="123456" placeholderTextColor={DesignColors.gray400} style={styles.input} value={otpCode} onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} textContentType="oneTimeCode" editable={!isVerifying} returnKeyType="done" onSubmitEditing={handleVerifyOtp}/>
          <Pressable accessibilityRole="button" disabled={isVerifying || otpCode.length !== 6} onPress={handleVerifyOtp} style={[styles.ctaButton, (isVerifying || otpCode.length !== 6) && styles.buttonDisabled]}>
           {isVerifying ? <ActivityIndicator color={DesignColors.white}/> : <Text style={styles.ctaText}>Verify and sign in</Text>}
          </Pressable>

         </View>) : null}
        {emailSubmitted ? <Pressable accessibilityRole="button" disabled={isVerifying} style={styles.secondaryButton} onPress={() => { setEmailSubmitted(false); setShowOtpFallback(false); setOtpCode(''); }}>
         <Text style={styles.secondaryText}>Use a different email or request a new link</Text>
        </Pressable> : null}
       </View>
      </View>
     </TouchableWithoutFeedback>
    </ScrollView>
   </KeyboardAvoidingView>
  </SafeAreaView>);
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DesignColors.background },
  flex: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingBottom: Spacing.xl },
  container: {
    width: '100%', maxWidth: 480, alignSelf: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl,
  },
  title: { fontSize: 30, color: DesignColors.black, fontFamily: 'Manrope_600SemiBold' },
  subtitle: { marginTop: Spacing.md, fontSize: 16, lineHeight: 24, color: DesignColors.gray600 },
  emailCard: {
    marginTop: Spacing.xl, backgroundColor: DesignColors.white,
    borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md,
  },
  fieldLabel: { fontSize: 16, color: DesignColors.black, fontFamily: 'Manrope_500Medium' },
  otpSection: { marginTop: Spacing.md, gap: Spacing.md },
  otpHint: { fontSize: 14, lineHeight: 20, color: DesignColors.gray600 },
  input: {
    minHeight: 52, borderRadius: BorderRadius.lg, backgroundColor: DesignColors.white,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 16,
    fontFamily: 'Manrope_400Regular', color: DesignColors.black,
    borderWidth: 1, borderColor: DesignColors.gray200,
  },
  ctaButton: {
    minHeight: 56, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, backgroundColor: DesignColors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: DesignColors.white, fontSize: 16, textAlign: 'center', fontFamily: 'Manrope_600SemiBold' },
  successMessage: { fontSize: 14, lineHeight: 20, color: DesignColors.successDark },
  magicLinkHelper: { gap: Spacing.sm },
  magicLinkCopy: { fontSize: 14, lineHeight: 20, color: DesignColors.gray600 },
  secondaryButton: { paddingVertical: Spacing.sm, minHeight: 44, justifyContent: 'center' },
  secondaryText: { fontSize: 14, color: DesignColors.infoDark, fontFamily: 'Manrope_500Medium' },
  buttonDisabled: { opacity: 0.5 },
});
