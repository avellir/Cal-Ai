import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type ProfileHeaderProps = {
  email: string;
  name: string;
  heightCm?: number | null;
  sex?: string | null;
  age?: number | null;
  loading?: boolean;
  onPress: () => void;
};

export function ProfileHeader({ email, name, heightCm, sex, age, loading = false, onPress }: ProfileHeaderProps) {
  const metrics =
    typeof heightCm === 'number' && sex && typeof age === 'number'
      ? `${Math.round(heightCm)}cm • ${sex} • ${Math.round(age)}y`
      : null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Edit profile and body metrics"
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          /* no-op */
        });
        onPress();
      }}
      style={styles.container}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color={DesignColors.iosSecondaryLabel} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {loading ? 'Loading…' : name}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {loading ? 'Loading…' : email}
        </Text>
        {metrics ? (
          <Text style={styles.metrics} numberOfLines={1}>
            {metrics}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={DesignColors.iosSecondaryLabel} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: DesignColors.iosSecondaryBackground,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  copy: {
    flex: 1,
    paddingRight: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: DesignColors.iosLabel,
  },
  email: {
    marginTop: 2,
    fontSize: 15,
    color: DesignColors.iosSecondaryLabel,
  },
  metrics: {
    marginTop: 4,
    fontSize: 13,
    color: DesignColors.iosSecondaryLabel,
  },
});
