import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressionOptions {
  maxDimension: number;  // Default: 1200
  quality: number;       // Default: 0.8
  format: 'jpeg' | 'png';
}

export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxDimension: 1200,
  quality: 0.8,
  format: 'jpeg',
};

/**
 * Calculates new dimensions while maintaining aspect ratio
 * If both dimensions are within maxDimension, returns original dimensions
 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const maxOriginal = Math.max(width, height);
  
  // If already within constraints, preserve original dimensions
  if (maxOriginal <= maxDimension) {
    return { width, height };
  }
  
  // Scale down maintaining aspect ratio
  const scale = maxDimension / maxOriginal;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Compresses an image while maintaining aspect ratio
 * - Resizes to max 1200px on longest side (configurable)
 * - Compresses with JPEG quality 0.8 (configurable)
 * - Falls back to original image on compression failure
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export async function compressImage(
  sourceUri: string,
  options?: Partial<CompressionOptions>
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    // First, get the original image info to determine dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(
      sourceUri,
      [], // No actions - just get info
      { base64: false }
    );
    
    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;
    
    // Calculate target dimensions
    const targetDimensions = calculateResizedDimensions(
      originalWidth,
      originalHeight,
      opts.maxDimension
    );
    
    // Determine if resize is needed
    const needsResize = 
      targetDimensions.width !== originalWidth || 
      targetDimensions.height !== originalHeight;
    
    // Build manipulation actions
    const actions: ImageManipulator.Action[] = [];
    
    if (needsResize) {
      actions.push({
        resize: {
          width: targetDimensions.width,
          height: targetDimensions.height,
        },
      });
    }
    
    // Apply compression with format and quality
    const saveOptions: ImageManipulator.SaveOptions = {
      compress: opts.quality,
      format: opts.format === 'png' 
        ? ImageManipulator.SaveFormat.PNG 
        : ImageManipulator.SaveFormat.JPEG,
    };
    
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      actions,
      saveOptions
    );
    
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    // Requirement 4.4: Fall back to original image on compression failure
    console.warn('Image compression failed, using original:', error);
    
    // Return original URI with unknown dimensions
    // The caller should handle this gracefully
    return {
      uri: sourceUri,
      width: 0,  // Unknown - compression failed
      height: 0, // Unknown - compression failed
    };
  }
}
