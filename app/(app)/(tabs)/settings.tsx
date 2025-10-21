import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileInputModal } from '@/components/profile-input-modal';
import { ThemedText } from '@/components/themed-text';
import { useUserProfileStore } from '@/store/userProfileStore';

export default function SettingsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const { profile } = useUserProfileStore();

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
});
