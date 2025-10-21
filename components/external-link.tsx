import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { Alert, GestureResponderEvent, Pressable, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';

type Props = {
  href: string;
  children: ReactNode;
};

export function ExternalLink({ href, children }: Props) {
  const handlePress = useCallback(
    async (_event: GestureResponderEvent) => {
      const supported = await Linking.canOpenURL(href);
      if (supported) {
        await Linking.openURL(href);
      } else {
        Alert.alert('Unable to open link', href);
      }
    },
    [href]
  );

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
});
