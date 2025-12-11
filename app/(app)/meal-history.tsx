import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesignColors, Typography } from '@/constants/theme';
import { useMealLogStore } from '@/lib/meal-log-store';
import type { MealLogEntry, MealType } from '@/lib/meal-log-types';
import { useSessionStore } from '@/lib/session-store';

type FilterType = 'all' | MealType;

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
];

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

type MealCardProps = {
  meal: MealLogEntry;
  onDelete: () => void;
  isDeleting: boolean;
};

function MealCard({ meal, onDelete, isDeleting }: MealCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealRow}>
        {meal.imageUri ? (
          <Image source={{ uri: meal.imageUri }} style={styles.mealImage} />
        ) : (
          <View style={styles.mealImagePlaceholder}>
            <Text style={styles.mealImageEmoji}>🍽️</Text>
          </View>
        )}
        <View style={styles.mealContent}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
            <Pressable
              style={styles.moreBtn}
              onPress={() => setShowActions(!showActions)}
              hitSlop={8}>
              <Feather name="more-vertical" size={18} color={DesignColors.gray400} />
            </Pressable>
          </View>
          <Text style={styles.mealTime}>{formatTime(meal.timestamp)}</Text>
          <View style={styles.mealMacros}>
            <Text style={styles.macroText}>🔥 {Math.round(meal.calories)}</Text>
            <Text style={styles.macroText}>🍗 {Math.round(meal.macros.protein)}g</Text>
            <Text style={styles.macroText}>🌾 {Math.round(meal.macros.carbs)}g</Text>
            <Text style={styles.macroText}>🥑 {Math.round(meal.macros.fat)}g</Text>
          </View>
        </View>
      </View>
      
      {showActions && (
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={onDelete}
            disabled={isDeleting}>
            {isDeleting ? (
              <ActivityIndicator size="small" color={DesignColors.error} />
            ) : (
              <>
                <Feather name="trash-2" size={16} color={DesignColors.error} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function MealHistoryScreen() {
  const session = useSessionStore((state) => state.session);
  const meals = useMealLogStore((state) => state.meals);
  const status = useMealLogStore((state) => state.status);
  const removeMeal = useMealLogStore((state) => state.removeMeal);
  const userId = session?.user?.id ?? null;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter and search meals
  const filteredMeals = useMemo(() => {
    let result = meals;

    // Apply meal type filter
    if (activeFilter !== 'all') {
      result = result.filter((m) => m.mealType === activeFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((m) => m.name.toLowerCase().includes(query));
    }

    return result;
  }, [meals, activeFilter, searchQuery]);

  // Group meals by date
  const groupedMeals = useMemo(() => {
    const groups: Record<string, MealLogEntry[]> = {};
    
    filteredMeals.forEach((meal) => {
      const dateKey = formatDate(meal.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(meal);
    });

    return Object.entries(groups);
  }, [filteredMeals]);

  const handleDelete = async (mealId: string) => {
    if (!userId) return;

    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(mealId);
            try {
              await removeMeal(userId, mealId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meal. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const isLoading = status === 'loading';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={DesignColors.black} />
        </Pressable>
        <Text style={styles.title}>Meal History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={DesignColors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search meals..."
          placeholderTextColor={DesignColors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Feather name="x" size={18} color={DesignColors.gray400} />
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}>
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.filterChip,
              activeFilter === option.value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(option.value)}>
            <Text
              style={[
                styles.filterChipText,
                activeFilter === option.value && styles.filterChipTextActive,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Meals List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={DesignColors.primary} />
            <Text style={styles.emptyText}>Loading meals...</Text>
          </View>
        ) : groupedMeals.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={DesignColors.gray300} />
            <Text style={styles.emptyTitle}>No meals found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || activeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Start logging meals to see them here'}
            </Text>
          </View>
        ) : (
          groupedMeals.map(([date, dateMeals]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {dateMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onDelete={() => handleDelete(meal.id)}
                  isDeleting={deletingId === meal.id}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignColors.gray100,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: DesignColors.black,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: DesignColors.gray100,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: DesignColors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: DesignColors.gray600,
  },
  filterChipTextActive: {
    color: DesignColors.white,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.gray500,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealCard: {
    backgroundColor: DesignColors.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mealImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  mealImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealImageEmoji: {
    fontSize: 24,
  },
  mealContent: {
    flex: 1,
    gap: 4,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
    flex: 1,
  },
  moreBtn: {
    padding: 4,
  },
  mealTime: {
    fontSize: 13,
    color: DesignColors.gray500,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  macroText: {
    fontSize: 12,
    color: DesignColors.gray600,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DesignColors.gray100,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtn: {
    backgroundColor: DesignColors.errorBg,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: DesignColors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
  },
  emptyText: {
    fontSize: 14,
    color: DesignColors.gray500,
    textAlign: 'center',
  },
});
