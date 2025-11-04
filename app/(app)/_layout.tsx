import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { bootstrapSession, useSessionStore } from '@/lib/session-store';

export default function AppLayout() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);

  useEffect(() => {
    bootstrapSession();
  }, []);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/signin" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="camera" options={{ headerShown: false }} />
      <Stack.Screen name="food-result" options={{ headerShown: false }} />
      <Stack.Screen name="goal-flow" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
