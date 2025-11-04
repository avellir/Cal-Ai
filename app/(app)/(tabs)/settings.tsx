import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileInputModal } from '@/components/profile-input-modal';
import { ThemedText } from '@/components/themed-text';
import { useSessionStore } from '@/lib/session-store';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserProfileStore } from '@/store/userProfileStore';

export default function SettingsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const { profile } = useUserProfileStore();
  const { session } = useSessionStore();
  const { goals, fetchGoals, hasGoals, getDailyTargets } = useUserGoalsStore();

  // Fetch goals on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchGoals(session.user.id);
    }
  }, [session?.user?.id]);

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

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>
          
          {profile.age || profile.height || profile.weight ? (
            <View style={styles.profileGrid}>
              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="calendar" size={24} color="#6B7280" />
                </View>
                <ThemedText style={styles.profileLabel}>Age</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.age ? `${profile.age} years` : 'Not set'}
                </ThemedText>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="resize" size={24} color="#6B7280" />
                </View>
                <ThemedText style={styles.profileLabel}>Height</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.height ? `${profile.height} cm` : 'Not set'}
                </ThemedText>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="fitness" size={24} color="#6B7280" />
                </View>
                <ThemedText style={styles.profileLabel}>Weight</ThemedText>
                <ThemedText style={styles.profileValue}>
                  {profile.weight ? `${profile.weight} kg` : 'Not set'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-circle-outline" size={48} color="#9CA3AF" />
              <ThemedText style={styles.emptyStateText}>No profile information set</ThemedText>
              <ThemedText style={styles.emptyStateSubtext}>
                Add your age, height, and weight to get personalized recommendations
              </ThemedText>
            </View>
          )}

          <Pressable 
            style={styles.editButton} 
            onPress={() => setModalVisible(true)}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.editButtonText}>
              {profile.age || profile.height || profile.weight ? 'Edit Profile' : 'Add Profile Info'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Customization Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Customization</ThemedText>
          
          {/* Personal Details Row */}
          <Pressable 
            style={styles.settingsRow} 
            onPress={() => setModalVisible(true)}>
            <View style={styles.settingsRowLeft}>
              <View style={styles.settingsIconContainer}>
                <Ionicons name="person-outline" size={20} color="#11181C" />
              </View>
              <ThemedText style={styles.settingsRowText}>Personal Details</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Adjust Goals Row */}
          <Pressable 
            style={styles.settingsRow} 
            onPress={handleAdjustGoals}>
            <View style={styles.settingsRowLeft}>
              <View style={styles.settingsIconContainer}>
                <Ionicons name="nutrition-outline" size={20} color="#11181C" />
              </View>
              <View style={styles.settingsRowContent}>
                <ThemedText style={styles.settingsRowText}>Adjust Goals</ThemedText>
                {hasGoals() && dailyTargets && (
                  <ThemedText style={styles.settingsRowSubtext}>
                    Daily target: {dailyTargets.calories} calories
                  </ThemedText>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>
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
    backgroundColor: '#FFFFFF',
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
    color: '#6B7280',
  },
  section: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  profileGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  profileCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
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
    color: '#6B7280',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
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
    backgroundColor: '#11181C',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
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
    color: '#11181C',
  },
  settingsRowSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
});
