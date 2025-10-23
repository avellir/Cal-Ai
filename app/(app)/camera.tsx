import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { analyzeAdvancedFoodImage } from '@/services/foodAnalysis';

export default function CameraScreen() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library permission is needed to select photos.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
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
        <ActivityIndicator size="large" color="#11181C" />
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
          <Feather name="x" size={24} color="#11181C" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>How would you like to add your meal?</Text>

        <Pressable style={styles.optionCard} onPress={handleTakePhoto}>
          <View style={styles.iconContainer}>
            <Feather name="camera" size={32} color="#11181C" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDescription}>
              Capture a photo of your meal using your camera
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.optionCard} onPress={handleChoosePhoto}>
          <View style={styles.iconContainer}>
            <Feather name="image" size={32} color="#11181C" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Choose from Library</Text>
            <Text style={styles.optionDescription}>
              Select an existing photo from your gallery
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>

        <View style={styles.infoBox}>
          <Feather name="info" size={16} color="#6B7280" />
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
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
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
    fontWeight: '700',
    color: '#11181C',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});

