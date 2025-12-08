import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesignColors } from '@/constants/theme';
import { ProfileInputModal } from '@/components/profile-input-modal';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { useSessionStore } from '@/lib/session-store';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserProfileStore } from '@/store/userProfileStore';

export default function SettingsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const { profile } = useUserProfileStore();
  const { session } = useSessionStore();
  const { fetchGoals, hasGoals, getDailyTargets } = useUserGoalsStore();

  // Fetch goals on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchGoals(session.user.id);
    }
  }, [session?.user?.id, fetchGoals]);

  const handleAdjustGoals = () => {
    router.push('/(app)/goal-flow' as any);
  };

  const dailyTargets = getDailyTargets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Profile Settings</ThemedText>
          <ThemedText style={styles.subtitle}>
            Manage your personal information and preferences.
          </ThemedText>
        </View>

        {/* Personal Info */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>
            <Badge label="Required" tone="info" />
          </View>
          {profile.age || profile.height || profile.weight ? (
            <View style={styles.profileGrid}>
              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="calendar" size={24} color={DesignColors.gray500} />
                </View>
                <ThemedText style={styles.profileLabel}>Age</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.age ? `${profile.age} years` : 'Not set'}
                </ThemedText>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="resize" size={24} color={DesignColors.gray500} />
                </View>
                <ThemedText style={styles.profileLabel}>Height</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.height ? `${profile.height} cm` : 'Not set'}
                </ThemedText>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="fitness" size={24} color={DesignColors.gray500} />
                </View>
                <ThemedText style={styles.profileLabel}>Weight</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.weight ? `${profile.weight} kg` : 'Not set'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-circle-outline" size={48} color={DesignColors.gray400} />
              <ThemedText style={styles.emptyStateText}>No profile information set</ThemedText>
              <ThemedText style={styles.emptyStateSubtext}>
                Add your age, height, and weight to get personalized recommendations
              </ThemedText>
            </View>
          )}

          <Pressable 
            style={styles.editButton} 
            onPress={() => setModalVisible(true)}>
            <Ionicons name="create-outline" size={20} color={DesignColors.white} />
            <ThemedText style={styles.editButtonText}>
              {profile.age || profile.height || profile.weight ? 'Edit Profile' : 'Add Profile Info'}
            </ThemedText>
          </Pressable>
        </Card>

        {/* Goals */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Goals</ThemedText>
            {hasGoals() && dailyTargets ? (
              <Chip label={`${dailyTargets.calories} cal/day`} />
            ) : (
              <Badge label="Not set" tone="warning" />
            )}
          </View>
          <ListRow
            title="Personal Details"
            subtitle="Age, height, weight"
            onPress={() => setModalVisible(true)}
            leftIcon={<Ionicons name="person-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
          <ListRow
            title="Adjust Goals"
            subtitle={hasGoals() && dailyTargets ? `Daily target: ${dailyTargets.calories} cal` : 'Set your calorie and macro targets'}
            onPress={handleAdjustGoals}
            leftIcon={<Ionicons name="nutrition-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
        </Card>

        {/* Preferences */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
            <Badge label="Coming soon" tone="neutral" />
          </View>
          <ListRow
            title="Units"
            subtitle="Metric"
            leftIcon={<Ionicons name="swap-horizontal" size={20} color={DesignColors.black} />}
            accessory={<Chip label="Metric" selected />}
          />
          <ListRow
            title="Reminders"
            subtitle="Set meal reminders"
            leftIcon={<Ionicons name="alarm-outline" size={20} color={DesignColors.black} />}
            accessory={<Badge label="Off" tone="neutral" />}
          />
          <ListRow
            title="Theme"
            subtitle="Light"
            leftIcon={<Ionicons name="color-palette-outline" size={20} color={DesignColors.black} />}
            accessory={<Badge label="Light" tone="neutral" />}
          />
        </Card>
      </ScrollView>

      <ProfileInputModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DesignColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
  },
  header: {
    gap: 12,
  },
  subtitle: {
    color: DesignColors.gray600,
  },
  section: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
  },
  profileGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  profileCard: {
    flex: 1,
    backgroundColor: DesignColors.gray50,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  profileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DesignColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: DesignColors.gray500,
    textAlign: 'center',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.black,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.gray500,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: DesignColors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 28,
    backgroundColor: DesignColors.primary,
  },
  editButtonText: {
    color: DesignColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DesignColors.gray50,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsRowContent: {
    flex: 1,
    gap: 4,
  },
  settingsRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
  },
  settingsRowSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: DesignColors.gray500,
  },
});
