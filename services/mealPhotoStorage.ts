import { supabase } from '@/lib/supabase';
import { compressImage } from './imageCompression';

const BUCKET_NAME = 'meal-photos';
const DEFAULT_SIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Extracts file extension from a URI
 * Defaults to 'jpg' if extension cannot be determined
 */
function getFileExtension(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  if (match) {
    const ext = match[1].toLowerCase();
    // Normalize common image extensions
    if (ext === 'jpeg') return 'jpg';
    if (['jpg', 'png', 'webp', 'gif'].includes(ext)) return ext;
  }
  return 'jpg'; // Default to jpg for compressed images
}

/**
 * Generates storage path following pattern: {profileId}/{mealId}.{ext}
 * 
 * Requirements: 3.2
 */
export function generateStoragePath(
  profileId: string,
  mealId: string,
  extension: string
): string {
  // Normalize extension (remove leading dot if present)
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${profileId}/${mealId}.${ext}`;
}


/**
 * Uploads a meal photo to Supabase Storage
 * - Compresses the image before upload
 * - Stores in path pattern: {profileId}/{mealId}.{ext}
 * - Returns the storage URL on success
 * 
 * Requirements: 1.1, 3.2
 */
export async function uploadMealPhoto(
  profileId: string,
  mealId: string,
  imageUri: string
): Promise<UploadResult> {
  try {
    // Compress image before upload (Requirements: 4.1, 4.2, 4.3, 4.4)
    const compressed = await compressImage(imageUri);
    const uploadUri = compressed.uri;
    
    // Determine file extension from compressed image
    const extension = getFileExtension(uploadUri);
    const storagePath = generateStoragePath(profileId, mealId, extension);
    
    // Determine content type
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
    
    // Read file as ArrayBuffer for React Native compatibility
    // (blob() method doesn't work reliably in React Native)
    const response = await fetch(uploadUri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true, // Allow overwriting if re-uploading
      });
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    console.error('Meal photo upload failed:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}


/**
 * Generates a signed URL for authenticated access to a stored photo
 * 
 * Requirements: 3.3
 * 
 * @param path - Storage path (e.g., "{profileId}/{mealId}.jpg")
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or null if generation fails
 */
export async function getSignedPhotoUrl(
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRATION
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);
    
    if (error) {
      console.error('Failed to generate signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL generation error:', error);
    return null;
  }
}

/**
 * Deletes a meal photo from Supabase Storage
 * Handles file-not-found gracefully (idempotent deletion)
 * 
 * Requirements: 1.4
 * 
 * @param profileId - User's profile ID
 * @param mealId - Meal ID
 */
export async function deleteMealPhoto(
  profileId: string,
  mealId: string
): Promise<void> {
  try {
    // Try common extensions - we don't know which was used
    const extensions = ['jpg', 'png', 'webp'];
    const paths = extensions.map(ext => generateStoragePath(profileId, mealId, ext));
    
    // Attempt to delete all possible paths
    // Supabase remove() handles non-existent files gracefully
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);
    
    if (error) {
      // Log but don't throw - deletion should be idempotent
      // File not found is acceptable (already deleted or never existed)
      console.warn('Photo deletion warning:', error.message);
    }
  } catch (error) {
    // Log but don't throw - we want idempotent deletion
    console.warn('Photo deletion error (non-fatal):', error);
  }
}

/**
 * Deletes a meal photo by its storage path
 * Handles file-not-found gracefully (idempotent deletion)
 * 
 * @param path - Full storage path to delete
 */
export async function deleteMealPhotoByPath(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      console.warn('Photo deletion warning:', error.message);
    }
  } catch (error) {
    console.warn('Photo deletion error (non-fatal):', error);
  }
}
