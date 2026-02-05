import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DesignColors } from '@/constants/theme';
import { analyzeAdvancedFoodImage } from '@/services/foodAnalysis';

export default function CameraScreen() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaLibraryPermission, setMediaLibraryPermission] =
    useState<ImagePicker.PermissionResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const preloadMediaLibraryPermission = async () => {
      try {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();

        if (!isMounted) {
          return;
        }

        if (!current.granted && current.canAskAgain) {
          const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();

          if (!isMounted) {
            return;
          }

          setMediaLibraryPermission(requested);
          return;
        }

        setMediaLibraryPermission(current);
      } catch (error) {
        console.error('Media library permission check error:', error);
      }
    };

    preloadMediaLibraryPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshPermission = async () => {
      try {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();

        if (!isMounted) {
          return;
        }

        setMediaLibraryPermission(current);
      } catch (error) {
        console.error('Media library permission refresh error:', error);
      }
    };

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshPermission();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const ensureMediaLibraryPermission = async () => {
    let permission = mediaLibraryPermission;

    if (!permission) {
      permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    }

    if (!permission.granted && permission.canAskAgain) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    setMediaLibraryPermission(permission);

    if (!permission.granted) {
      Alert.alert(
        'Permission Required',
        'Photo library permission is needed to select photos.'
      );
      return false;
    }

    return true;
  };

  const handleTakePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to take photos of your meals.'
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleChoosePhoto = async () => {
    try {
      const hasPermission = await ensureMediaLibraryPermission();

      if (!hasPermission) {
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const analyzeImage = async (imageUri: string) => {
    setIsAnalyzing(true);

    try {
      const result = await analyzeAdvancedFoodImage(imageUri);

      setIsAnalyzing(false);

      if (result.success && result.data) {
        // Use the simplified nutrition data structure
        const foodName = result.data.foodName;
        const servingSize = result.data.servingSize;

        // Navigate to results screen with nutrition data
        router.push({
          pathname: '/(app)/food-result',
          params: {
            foodName,
            calories: result.data.calories.toString(),
            protein: result.data.protein.toString(),
            carbs: result.data.carbs.toString(),
            fat: result.data.fat.toString(),
            servingSize,
            confidence: result.data.confidence.toString(),
            imageUri,
            reasoning: result.data.reasoning || '',
            warnings: result.data.warnings?.length ? JSON.stringify(result.data.warnings) : undefined,
            // Pass ingredient breakdown for transparency
            ingredientsData: result.data.ingredients?.length
              ? JSON.stringify(result.data.ingredients.map(ing => ({
                  name: ing.name,
                  quantity: ing.grams,
                  unit: 'g',
                  calories: ing.calories,
                  protein: ing.protein,
                  carbs: ing.carbs,
                  fat: ing.fat,
                })))
              : undefined,
          },
        });
      } else {
        Alert.alert(
          'Analysis Failed',
          result.error || 'Could not analyze the food image. Please try again.'
        );
      }
    } catch (error) {
      console.error('Food analysis failed:', error);
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze image. Please try again.');
    }
  };

  if (isAnalyzing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignColors.black} />
        <Text style={styles.loadingText}>Analyzing your food...</Text>
        <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Food</Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Feather name="x" size={24} color={DesignColors.black} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Card style={styles.heroCard} elevation="md">
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Feather name="camera" size={20} color={DesignColors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Best results</Text>
              <Text style={styles.heroSubtitle}>Good lighting, one plate per shot</Text>
            </View>
          </View>
          <View style={styles.heroChips}>
            <Chip label="Avoid glare" />
            <Chip label="Center the plate" />
            <Chip label="Hold steady" />
          </View>
        </Card>

        <Pressable style={styles.optionCard} onPress={handleTakePhoto}>
          <View style={styles.iconContainer}>
            <Feather name="camera" size={32} color={DesignColors.black} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDescription}>
              Capture a photo of your meal using your camera
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={DesignColors.gray400} />
        </Pressable>

        <Pressable style={styles.optionCard} onPress={handleChoosePhoto}>
          <View style={styles.iconContainer}>
            <Feather name="image" size={32} color={DesignColors.black} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Choose from Library</Text>
            <Text style={styles.optionDescription}>
              Select an existing photo from your gallery
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={DesignColors.gray400} />
        </Pressable>

        <View style={styles.infoBox}>
          <Feather name="info" size={16} color={DesignColors.gray500} />
          <Text style={styles.infoText}>
            Our AI will analyze your food and provide nutritional information
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignColors.white,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: DesignColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: DesignColors.black,
  },
  loadingSubtext: {
    fontSize: 14,
    color: DesignColors.gray500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: DesignColors.black,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  heroCard: {
    gap: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: DesignColors.black,
  },
  heroSubtitle: {
    fontSize: 14,
    color: DesignColors.gray500,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignColors.gray50,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DesignColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: DesignColors.black,
  },
  optionDescription: {
    fontSize: 14,
    color: DesignColors.gray500,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: DesignColors.infoBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DesignColors.info,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: DesignColors.info,
    lineHeight: 18,
  },
});
