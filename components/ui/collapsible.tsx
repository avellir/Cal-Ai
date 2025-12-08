import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, DesignColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Collapsible({ title, children, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = useMemo(
    () => (colorScheme === 'light' ? DesignColors.gray50 : Colors.dark.background),
    [colorScheme]
  );

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <Pressable onPress={toggle} style={styles.header} accessibilityRole="button">
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={Colors[colorScheme].text}
        />
      </Pressable>
      {isOpen ? <View style={styles.content}>{children}</View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    marginRight: 12,
  },
  content: {
    marginTop: 12,
    gap: 12,
  },
});
