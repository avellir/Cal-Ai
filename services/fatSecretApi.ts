/**
 * FatSecret Platform API Integration
 * 
 * Provides OAuth 2.0 authentication, token management, and nutritional data lookup
 * from the FatSecret Platform API with rate limiting and request queue management.
 * 
 * Requirements: 3.1, 6.1, 8.3
 */

// ============================================================================
// Types
// ============================================================================

type FatSecretToken = {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
};

type FatSecretConfig = {
  clientId: string;
  clientSecret: string;
};

// ============================================================================
// Token Management
// ============================================================================

let fatSecretToken: FatSecretToken | null = null;

/**
 * Gets a valid FatSecret OAuth 2.0 access token
 * Returns cached token if still valid, otherwise requests a new one
 * 
 * @throws Error if credentials are not configured or authentication fails
 */
export async function getFatSecretAccessToken(): Promise<string> {
  // Return cached token if still valid (with 1 minute buffer)
  if (fatSecretToken && Date.now() < fatSecretToken.expiresAt) {
    return fatSecretToken.accessToken;
  }

  // Get credentials from environment
  const config = getFatSecretConfig();

  // OAuth 2.0 Client Credentials flow
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  
  try {
    const response = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`FatSecret authentication failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Cache token with expiration (refresh 1 minute early to avoid edge cases)
    fatSecretToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
    };

    return fatSecretToken.accessToken;
  } catch (error) {
    // Clear cached token on error
    fatSecretToken = null;
    
    if (error instanceof Error) {
      throw new Error(`Failed to authenticate with FatSecret API: ${error.message}`);
    }
    throw new Error('Failed to authenticate with FatSecret API');
  }
}

/**
 * Gets FatSecret API credentials from environment variables
 * 
 * @throws Error if credentials are not configured
 */
function getFatSecretConfig(): FatSecretConfig {
  const clientId = 
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID || 
    process.env.FATSECRET_CLIENT_ID;
  
  const clientSecret = 
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET || 
    process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'FatSecret API credentials not configured. ' +
      'Please add EXPO_PUBLIC_FATSECRET_CLIENT_ID and EXPO_PUBLIC_FATSECRET_CLIENT_SECRET to your .env file'
    );
  }

  return { clientId, clientSecret };
}

/**
 * Clears the cached FatSecret token
 * Useful for testing or forcing token refresh
 */
export function clearFatSecretToken(): void {
  fatSecretToken = null;
}

// ============================================================================
// Request Queue Management
// ============================================================================

type QueuedRequest<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

/**
 * Configuration options for FatSecretRequestQueue
 */
type QueueConfig = {
  delayMs?: number;
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

/**
 * Request queue to manage FatSecret API rate limiting
 * Processes requests sequentially with configurable delay between requests
 * Supports concurrent processing and automatic retry logic
 * 
 * Free tier: 5000 requests/day
 * Recommended delay: 200ms between requests (max ~18,000 requests/hour)
 * 
 * Requirements: 8.3
 */
class FatSecretRequestQueue {
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private activeRequests = 0;
  private readonly delayMs: number;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private totalProcessed = 0;
  private totalErrors = 0;
  private totalRetries = 0;

  /**
   * Creates a new request queue with configurable options
   * 
   * @param config - Queue configuration options
   */
  constructor(config: QueueConfig = {}) {
    this.delayMs = config.delayMs ?? 200;
    this.maxConcurrent = config.maxConcurrent ?? 1; // Sequential by default
    this.maxRetries = config.maxRetries ?? 0; // No retries by default (handled by makeFatSecretRequest)
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  /**
   * Enqueues a request to be executed with rate limiting
   * 
   * @param request - Function that returns a Promise to execute
   * @returns Promise that resolves with the request result
   */
  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: request as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processes queued requests with rate limiting and concurrency control
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0 || this.activeRequests > 0) {
      // Wait if we've reached max concurrent requests
      if (this.activeRequests >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Get next request from queue
      const request = this.queue.shift();
      if (!request) {
        // No more requests in queue, wait for active requests to complete
        if (this.activeRequests > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        continue;
      }

      // Process request with retry logic
      this.activeRequests++;
      this.processRequest(request, 0).finally(() => {
        this.activeRequests--;
      });

      // Add delay between starting requests
      if (this.queue.length > 0 || this.activeRequests < this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    this.processing = false;
  }

  /**
   * Processes a single request with retry logic
   * 
   * @param request - Request to process
   * @param retryCount - Current retry attempt
   */
  private async processRequest(
    request: QueuedRequest<unknown>,
    retryCount: number
  ): Promise<void> {
    try {
      const result = await request.execute();
      request.resolve(result);
      this.totalProcessed++;
    } catch (error) {
      // Retry if configured and not exceeded max retries
      if (retryCount < this.maxRetries) {
        this.totalRetries++;
        const delay = this.retryDelayMs * Math.pow(2, retryCount); // Exponential backoff
        console.warn(
          `Request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.processRequest(request, retryCount + 1);
      }

      // Max retries exceeded or no retries configured
      this.totalErrors++;
      request.reject(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Returns the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Returns whether the queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Returns the number of active requests being processed
   */
  getActiveRequests(): number {
    return this.activeRequests;
  }

  /**
   * Returns queue statistics
   */
  getStats(): {
    queueLength: number;
    activeRequests: number;
    isProcessing: boolean;
    totalProcessed: number;
    totalErrors: number;
    totalRetries: number;
    config: {
      delayMs: number;
      maxConcurrent: number;
      maxRetries: number;
      retryDelayMs: number;
    };
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      totalRetries: this.totalRetries,
      config: {
        delayMs: this.delayMs,
        maxConcurrent: this.maxConcurrent,
        maxRetries: this.maxRetries,
        retryDelayMs: this.retryDelayMs,
      },
    };
  }

  /**
   * Resets queue statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.totalErrors = 0;
    this.totalRetries = 0;
  }

  /**
   * Clears all pending requests from the queue
   * Active requests will continue to process
   * 
   * @returns Number of requests cleared
   */
  clear(): number {
    const clearedCount = this.queue.length;
    
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    
    this.queue = [];
    return clearedCount;
  }

  /**
   * Updates queue configuration
   * Changes take effect for new requests
   * 
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<QueueConfig>): void {
    if (config.delayMs !== undefined) {
      (this as unknown as { delayMs: number }).delayMs = config.delayMs;
    }
    if (config.maxConcurrent !== undefined) {
      (this as unknown as { maxConcurrent: number }).maxConcurrent = config.maxConcurrent;
    }
    if (config.maxRetries !== undefined) {
      (this as unknown as { maxRetries: number }).maxRetries = config.maxRetries;
    }
    if (config.retryDelayMs !== undefined) {
      (this as unknown as { retryDelayMs: number }).retryDelayMs = config.retryDelayMs;
    }
  }
}

// Global request queue instance with default configuration
const fatSecretQueue = new FatSecretRequestQueue({
  delayMs: 200, // 200ms between requests
  maxConcurrent: 1, // Sequential processing
  maxRetries: 0, // Retries handled by makeFatSecretRequest
  retryDelayMs: 1000,
});

/**
 * Gets the global FatSecret request queue instance
 * Useful for monitoring queue status and configuration
 * 
 * Requirements: 8.3
 */
export function getFatSecretQueue(): {
  stats: {
    queueLength: number;
    activeRequests: number;
    isProcessing: boolean;
    totalProcessed: number;
    totalErrors: number;
    totalRetries: number;
    config: {
      delayMs: number;
      maxConcurrent: number;
      maxRetries: number;
      retryDelayMs: number;
    };
  };
  resetStats: () => void;
  clear: () => number;
  updateConfig: (config: Partial<QueueConfig>) => void;
} {
  return {
    stats: fatSecretQueue.getStats(),
    resetStats: () => fatSecretQueue.resetStats(),
    clear: () => fatSecretQueue.clear(),
    updateConfig: (config: Partial<QueueConfig>) => fatSecretQueue.updateConfig(config),
  };
}

// ============================================================================
// API Request Helpers
// ============================================================================

/**
 * Makes an authenticated request to the FatSecret Platform API
 * Automatically handles token refresh and queues requests for rate limiting
 * Includes retry logic with exponential backoff for transient failures
 * 
 * Requirements: 6.1, 6.4, 8.5
 * 
 * @param method - FatSecret API method name (e.g., 'foods.search')
 * @param params - Additional query parameters
 * @param retryCount - Internal retry counter for exponential backoff
 * @returns Parsed JSON response
 * @throws Error if request fails after retries
 */
export async function makeFatSecretRequest(
  method: string,
  params: Record<string, string> = {},
  retryCount: number = 0
): Promise<unknown> {
  const MAX_RETRIES = 3;
  
  return fatSecretQueue.enqueue(async () => {
    try {
      const token = await getFatSecretAccessToken();

      const queryParams = new URLSearchParams({
        method,
        format: 'json',
        ...params,
      });

      const response = await fetch(
        `https://platform.fatsecret.com/rest/server.api?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        // Handle rate limiting with exponential backoff (Requirement 6.4, 8.5)
        if (response.status === 429 && retryCount < MAX_RETRIES) {
          const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.warn(
            `FatSecret rate limit hit, retrying in ${delayMs}ms ` +
            `(attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return makeFatSecretRequest(method, params, retryCount + 1);
        }

        // Handle token expiration (Requirement 6.1)
        if (response.status === 401) {
          clearFatSecretToken();
          if (retryCount < 1) {
            console.warn('FatSecret token expired, refreshing and retrying');
            return makeFatSecretRequest(method, params, retryCount + 1);
          }
        }

        // Handle server errors with retry (Requirement 6.4)
        if (response.status >= 500 && response.status < 600 && retryCount < MAX_RETRIES) {
          const delayMs = Math.pow(2, retryCount) * 1000;
          console.warn(
            `FatSecret server error (${response.status}), retrying in ${delayMs}ms ` +
            `(attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return makeFatSecretRequest(method, params, retryCount + 1);
        }

        throw new Error(`FatSecret API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors with retry (Requirement 6.4)
      if (
        error instanceof Error &&
        (error.message.includes('network') || 
         error.message.includes('fetch') ||
         error.message.includes('ENOTFOUND') ||
         error.message.includes('ECONNREFUSED')) &&
        retryCount < MAX_RETRIES
      ) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        console.warn(
          `FatSecret network error, retrying in ${delayMs}ms ` +
          `(attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return makeFatSecretRequest(method, params, retryCount + 1);
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error during FatSecret API request');
    }
  });
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validates that FatSecret API credentials are configured
 * 
 * @returns true if credentials are configured, false otherwise
 */
export function isFatSecretConfigured(): boolean {
  try {
    getFatSecretConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Tests FatSecret API connection by requesting a token
 * Useful for validating credentials during app startup
 * 
 * @returns true if connection successful, false otherwise
 */
export async function testFatSecretConnection(): Promise<boolean> {
  try {
    await getFatSecretAccessToken();
    return true;
  } catch (error) {
    console.error('FatSecret connection test failed:', error);
    return false;
  }
}

// ============================================================================
// Ingredient Search Result Cache
// ============================================================================

/**
 * Cache entry for ingredient search results
 */
type CacheEntry<T> = {
  value: T;
  timestamp: number;
  expiresAt: number;
};

/**
 * In-memory cache for ingredient search results
 * Reduces redundant API calls for common ingredients
 * 
 * Requirements: 3.5, 8.2
 */
class IngredientSearchCache {
  private cache: Map<string, CacheEntry<string | null>> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  /**
   * Creates a new ingredient search cache
   * 
   * @param ttlMs - Time-to-live in milliseconds (default: 1 hour)
   * @param maxSize - Maximum number of entries (default: 500)
   */
  constructor(ttlMs: number = 3600000, maxSize: number = 500) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Gets a cached search result
   * 
   * @param key - Cache key (normalized ingredient name)
   * @returns Cached food ID or undefined if not found/expired
   */
  get(key: string): string | null | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Sets a search result in the cache
   * 
   * @param key - Cache key (normalized ingredient name)
   * @param value - Food ID or null if not found
   */
  set(key: string, value: string | null): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<string | null> = {
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    };

    this.cache.set(key, entry);
  }

  /**
   * Checks if a key exists in the cache and is not expired
   * 
   * @param key - Cache key
   * @returns true if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Removes expired entries from the cache
   * 
   * @returns Number of entries removed
   */
  cleanExpired(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Evicts the oldest entry from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Gets cache statistics
   * 
   * @returns Cache stats object
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Invalidates cache entries matching a pattern
   * 
   * @param pattern - RegExp pattern to match keys
   * @returns Number of entries invalidated
   */
  invalidatePattern(pattern: RegExp): number {
    let invalidatedCount = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }
}

// Global cache instance
const ingredientSearchCache = new IngredientSearchCache();

/**
 * Gets the global ingredient search cache instance
 * Useful for monitoring cache status and manual invalidation
 */
export function getIngredientSearchCache(): {
  stats: {
    size: number;
    maxSize: number;
    ttlMs: number;
  };
  clear: () => void;
  cleanExpired: () => number;
  invalidatePattern: (pattern: RegExp) => number;
} {
  return {
    stats: ingredientSearchCache.getStats(),
    clear: () => ingredientSearchCache.clear(),
    cleanExpired: () => ingredientSearchCache.cleanExpired(),
    invalidatePattern: (pattern: RegExp) => ingredientSearchCache.invalidatePattern(pattern),
  };
}

/**
 * Normalizes ingredient name for cache key
 * Converts to lowercase, removes extra spaces, and standardizes format
 * 
 * @param name - Ingredient name
 * @returns Normalized cache key
 */
function normalizeCacheKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, ''); // Remove special characters except spaces and hyphens
}

// ============================================================================
// Food Search and Lookup (Stage 3)
// ============================================================================

/**
 * Searches FatSecret database for a food item by name
 * Returns the food ID of the most relevant match, or null if not found
 * Uses caching to reduce redundant API calls
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5, 8.2
 * 
 * @param ingredientName - Name of the ingredient to search for
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns FatSecret food ID of the best match, or null if not found
 */
export async function searchFatSecretFood(
  ingredientName: string,
  maxResults: number = 5
): Promise<string | null> {
  // Check cache first
  const cacheKey = normalizeCacheKey(ingredientName);
  const cachedResult = ingredientSearchCache.get(cacheKey);
  
  if (cachedResult !== undefined) {
    console.log(`Cache hit for "${ingredientName}"`);
    return cachedResult;
  }
  try {
    const response = await makeFatSecretRequest('foods.search', {
      search_expression: ingredientName,
      max_results: maxResults.toString(),
    });

    // Parse response
    const data = response as { foods?: { food?: unknown[] | unknown } };
    
    if (!data.foods) {
      console.warn(`No foods found for "${ingredientName}"`);
      // Cache negative result to avoid repeated failed searches
      ingredientSearchCache.set(cacheKey, null);
      return null;
    }

    // Handle both array and single object responses
    const foods = Array.isArray(data.foods.food) 
      ? data.foods.food 
      : data.foods.food 
        ? [data.foods.food] 
        : [];

    if (foods.length === 0) {
      console.warn(`No foods found for "${ingredientName}"`);
      // Cache negative result
      ingredientSearchCache.set(cacheKey, null);
      return null;
    }

    // Return the first (most relevant) food ID
    const firstFood = foods[0] as { food_id?: string };
    const foodId = firstFood.food_id || null;
    
    // Cache the result
    ingredientSearchCache.set(cacheKey, foodId);
    
    return foodId;
  } catch (error) {
    console.error(`FatSecret search failed for "${ingredientName}":`, error);
    // Don't cache errors - allow retry on next attempt
    return null;
  }
}

/**
 * Searches for a food item with alternative search terms
 * Tries multiple variations to improve match rate:
 * 1. Exact name
 * 2. Name with preparation method
 * 3. Name without preparation method
 * Uses caching to reduce redundant searches
 * 
 * Requirements: 3.2, 3.4, 3.5, 8.2
 * 
 * @param ingredientName - Base ingredient name
 * @param preparation - Optional preparation method (e.g., "grilled", "fried")
 * @returns FatSecret food ID of the best match, or null if not found
 */
export async function searchFatSecretFoodWithAlternatives(
  ingredientName: string,
  preparation?: string
): Promise<string | null> {
  // Create a composite cache key for the full search with alternatives
  const compositeCacheKey = normalizeCacheKey(
    preparation ? `${ingredientName}|${preparation}` : ingredientName
  );
  
  // Check if we've already searched with alternatives for this ingredient
  const cachedCompositeResult = ingredientSearchCache.get(compositeCacheKey);
  if (cachedCompositeResult !== undefined) {
    console.log(`Cache hit for alternative search "${ingredientName}" with prep "${preparation || 'none'}"`);
    return cachedCompositeResult;
  }

  // Try exact name first
  let foodId = await searchFatSecretFood(ingredientName);
  if (foodId) {
    // Cache the composite result
    ingredientSearchCache.set(compositeCacheKey, foodId);
    return foodId;
  }

  // Try with preparation method if provided
  if (preparation) {
    const withPreparation = `${ingredientName} ${preparation}`;
    foodId = await searchFatSecretFood(withPreparation);
    if (foodId) {
      ingredientSearchCache.set(compositeCacheKey, foodId);
      return foodId;
    }

    // Try removing preparation from the name if it's already included
    const withoutPreparation = ingredientName
      .replace(new RegExp(preparation, 'gi'), '')
      .trim();
    
    if (withoutPreparation !== ingredientName) {
      foodId = await searchFatSecretFood(withoutPreparation);
      if (foodId) {
        ingredientSearchCache.set(compositeCacheKey, foodId);
        return foodId;
      }
    }
  }

  // Try common variations
  const variations = [
    ingredientName.replace(/s$/, ''), // Remove plural
    ingredientName + 's', // Add plural
    ingredientName.replace(/\b(raw|cooked|fresh)\b/gi, '').trim(), // Remove common modifiers
  ];

  for (const variation of variations) {
    if (variation !== ingredientName && variation.length > 0) {
      foodId = await searchFatSecretFood(variation);
      if (foodId) {
        ingredientSearchCache.set(compositeCacheKey, foodId);
        return foodId;
      }
    }
  }

  // Cache the negative result for the composite search
  ingredientSearchCache.set(compositeCacheKey, null);
  return null;
}

/**
 * Retrieves detailed nutritional information for a food item by ID
 * 
 * Requirements: 3.1, 3.3, 5.3
 * 
 * @param foodId - FatSecret food ID
 * @returns Nutritional data or null if retrieval fails
 */
export async function getFatSecretNutrition(
  foodId: string
): Promise<{
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  servingUnit: string;
} | null> {
  try {
    const response = await makeFatSecretRequest('food.get.v2', {
      food_id: foodId,
    });

    // Parse response
    const data = response as { food?: unknown };
    
    if (!data.food) {
      console.warn(`No food data found for ID "${foodId}"`);
      return null;
    }

    const food = data.food as {
      food_id?: string;
      food_name?: string;
      servings?: {
        serving?: unknown[] | unknown;
      };
    };

    // Extract nutrition from first serving
    if (!food.servings?.serving) {
      console.warn(`No serving data found for food ID "${foodId}"`);
      return null;
    }

    const servings = Array.isArray(food.servings.serving)
      ? food.servings.serving
      : [food.servings.serving];

    if (servings.length === 0) {
      console.warn(`Empty serving data for food ID "${foodId}"`);
      return null;
    }

    // Use the first serving (typically the most common/standard serving)
    const serving = servings[0] as {
      calories?: string;
      protein?: string;
      carbohydrate?: string;
      fat?: string;
      serving_description?: string;
      measurement_description?: string;
      metric_serving_amount?: string;
      metric_serving_unit?: string;
    };

    // Parse nutritional values
    const calories = parseFloat(serving.calories || '0');
    const protein = parseFloat(serving.protein || '0');
    const carbs = parseFloat(serving.carbohydrate || '0');
    const fat = parseFloat(serving.fat || '0');

    // Determine serving size and unit
    const servingSize = serving.serving_description || 
                       `${serving.metric_serving_amount || '100'} ${serving.metric_serving_unit || 'g'}`;
    const servingUnit = serving.measurement_description || 
                       serving.metric_serving_unit || 
                       'serving';

    return {
      foodId: food.food_id || foodId,
      foodName: food.food_name || 'Unknown',
      calories,
      protein,
      carbs,
      fat,
      servingSize,
      servingUnit,
    };
  } catch (error) {
    console.error(`FatSecret nutrition retrieval failed for food ID "${foodId}":`, error);
    return null;
  }
}

/**
 * Retrieves all available serving sizes for a food item
 * Useful for providing users with multiple serving options
 * 
 * Requirements: 3.3
 * 
 * @param foodId - FatSecret food ID
 * @returns Array of serving options with nutritional data
 */
export async function getFatSecretServings(
  foodId: string
): Promise<Array<{
  servingDescription: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}>> {
  try {
    const response = await makeFatSecretRequest('food.get.v2', {
      food_id: foodId,
    });

    const data = response as { food?: { servings?: { serving?: unknown[] | unknown } } };
    
    if (!data.food?.servings?.serving) {
      return [];
    }

    const servings = Array.isArray(data.food.servings.serving)
      ? data.food.servings.serving
      : [data.food.servings.serving];

    return servings.map((serving: unknown) => {
      const s = serving as {
        serving_description?: string;
        calories?: string;
        protein?: string;
        carbohydrate?: string;
        fat?: string;
      };

      return {
        servingDescription: s.serving_description || 'Unknown serving',
        calories: parseFloat(s.calories || '0'),
        protein: parseFloat(s.protein || '0'),
        carbs: parseFloat(s.carbohydrate || '0'),
        fat: parseFloat(s.fat || '0'),
      };
    });
  } catch (error) {
    console.error(`Failed to retrieve servings for food ID "${foodId}":`, error);
    return [];
  }
}

// ============================================================================
// USDA Fallback System
// ============================================================================

/**
 * USDA nutritional database for common ingredients (per 100g)
 * Used as fallback when FatSecret lookup fails
 * 
 * Requirements: 3.4, 6.1
 */
const USDA_DATABASE: Record<string, {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}> = {
  // Proteins
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'chicken thigh': { calories: 209, protein: 26, carbs: 0, fat: 10.9 },
  'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'beef': { calories: 250, protein: 26, carbs: 0, fat: 15 },
  'ground beef': { calories: 250, protein: 26, carbs: 0, fat: 15 },
  'pork': { calories: 242, protein: 27, carbs: 0, fat: 14 },
  'salmon': { calories: 208, protein: 20, carbs: 0, fat: 13 },
  'tuna': { calories: 144, protein: 23, carbs: 0, fat: 5 },
  'shrimp': { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  'egg': { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  'tofu': { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  
  // Grains & Starches
  'white rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  'brown rice': { calories: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  'pasta': { calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  'bread': { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  'potato': { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  'sweet potato': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  'quinoa': { calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  'oats': { calories: 389, protein: 17, carbs: 66, fat: 6.9 },
  
  // Vegetables
  'broccoli': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  'carrot': { calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  'bell pepper': { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  'pepper': { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  'onion': { calories: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  'tomato': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  'lettuce': { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  'spinach': { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  'cucumber': { calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 },
  'zucchini': { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  'mushroom': { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  'corn': { calories: 86, protein: 3.3, carbs: 19, fat: 1.4 },
  'peas': { calories: 81, protein: 5, carbs: 14, fat: 0.4 },
  'green beans': { calories: 31, protein: 1.8, carbs: 7, fat: 0.2 },
  
  // Fruits
  'apple': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  'banana': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  'orange': { calories: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  'strawberry': { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  'blueberry': { calories: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  'avocado': { calories: 160, protein: 2, carbs: 8.5, fat: 15 },
  
  // Dairy
  'milk': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  'cheese': { calories: 402, protein: 25, carbs: 1.3, fat: 33 },
  'cheddar cheese': { calories: 402, protein: 25, carbs: 1.3, fat: 33 },
  'mozzarella': { calories: 280, protein: 28, carbs: 3.1, fat: 17 },
  'yogurt': { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  'butter': { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  
  // Oils & Fats
  'olive oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'vegetable oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'coconut oil': { calories: 862, protein: 0, carbs: 0, fat: 100 },
  
  // Condiments & Sauces
  'soy sauce': { calories: 53, protein: 5.6, carbs: 4.9, fat: 0.1 },
  'ketchup': { calories: 112, protein: 1.2, carbs: 27, fat: 0.1 },
  'mayonnaise': { calories: 680, protein: 1, carbs: 0.6, fat: 75 },
  'mustard': { calories: 66, protein: 4, carbs: 6, fat: 4 },
  'hot sauce': { calories: 12, protein: 0.9, carbs: 2.1, fat: 0.3 },
  
  // Nuts & Seeds
  'almond': { calories: 579, protein: 21, carbs: 22, fat: 50 },
  'peanut': { calories: 567, protein: 26, carbs: 16, fat: 49 },
  'walnut': { calories: 654, protein: 15, carbs: 14, fat: 65 },
  'cashew': { calories: 553, protein: 18, carbs: 30, fat: 44 },
  
  // Legumes
  'black beans': { calories: 132, protein: 8.9, carbs: 24, fat: 0.5 },
  'kidney beans': { calories: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  'chickpeas': { calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  'lentils': { calories: 116, protein: 9, carbs: 20, fat: 0.4 },
};

/**
 * Gets USDA fallback nutritional data for an ingredient
 * Used when FatSecret lookup fails
 * 
 * Requirements: 3.4, 6.1
 * 
 * @param ingredientName - Name of the ingredient
 * @param quantityGrams - Quantity in grams (defaults to 100g)
 * @returns Nutritional data based on USDA values
 */
export function getUSDAFallback(
  ingredientName: string,
  quantityGrams: number = 100
): {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  servingUnit: string;
  isUSDAFallback: boolean;
} {
  // Normalize ingredient name for lookup
  const normalizedName = ingredientName.toLowerCase().trim();
  
  // Try exact match first
  let usdaData = USDA_DATABASE[normalizedName];
  
  // Try partial matches if exact match fails
  if (!usdaData) {
    const matchingKey = Object.keys(USDA_DATABASE).find(key => 
      normalizedName.includes(key) || key.includes(normalizedName)
    );
    
    if (matchingKey) {
      usdaData = USDA_DATABASE[matchingKey];
    }
  }
  
  // Use generic fallback if no match found
  if (!usdaData) {
    console.warn(`No USDA data found for "${ingredientName}", using generic fallback`);
    usdaData = { calories: 100, protein: 5, carbs: 15, fat: 3 };
  }
  
  // Scale nutrition based on quantity
  const scaleFactor = quantityGrams / 100;
  
  return {
    foodId: 'usda_fallback',
    foodName: ingredientName,
    calories: Math.round(usdaData.calories * scaleFactor),
    protein: Math.round(usdaData.protein * scaleFactor * 10) / 10,
    carbs: Math.round(usdaData.carbs * scaleFactor * 10) / 10,
    fat: Math.round(usdaData.fat * scaleFactor * 10) / 10,
    servingSize: `${quantityGrams}g`,
    servingUnit: 'g',
    isUSDAFallback: true,
  };
}

/**
 * Checks if an ingredient exists in the USDA database
 * 
 * @param ingredientName - Name of the ingredient
 * @returns true if ingredient is in USDA database
 */
export function hasUSDAData(ingredientName: string): boolean {
  const normalizedName = ingredientName.toLowerCase().trim();
  
  // Check exact match
  if (USDA_DATABASE[normalizedName]) {
    return true;
  }
  
  // Check partial matches
  return Object.keys(USDA_DATABASE).some(key => 
    normalizedName.includes(key) || key.includes(normalizedName)
  );
}

// ============================================================================
// Ingredient Nutrition Lookup with Scaling
// ============================================================================

/**
 * Unit conversion table to grams
 * Used for standardizing ingredient quantities
 * 
 * Requirements: 2.2, 3.2
 */
const UNIT_TO_GRAMS: Record<string, number> = {
  'g': 1,
  'gram': 1,
  'grams': 1,
  'ml': 1, // Approximate for most liquids (water density)
  'milliliter': 1,
  'milliliters': 1,
  'oz': 28.35,
  'ounce': 28.35,
  'ounces': 28.35,
  'cup': 240,
  'cups': 240,
  'tbsp': 15,
  'tablespoon': 15,
  'tablespoons': 15,
  'tsp': 5,
  'teaspoon': 5,
  'teaspoons': 5,
  'piece': 100, // Rough estimate
  'pieces': 100,
  'serving': 100, // Generic serving
  'servings': 100,
  'lb': 453.592,
  'pound': 453.592,
  'pounds': 453.592,
  'kg': 1000,
  'kilogram': 1000,
  'kilograms': 1000,
};

/**
 * Converts a quantity from any unit to grams
 * 
 * Requirements: 2.2, 3.2
 * 
 * @param quantity - Numeric quantity value
 * @param unit - Unit of measurement
 * @returns Quantity in grams
 */
export function convertToGrams(quantity: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim();
  const conversionFactor = UNIT_TO_GRAMS[normalizedUnit];
  
  if (!conversionFactor) {
    console.warn(`Unknown unit "${unit}", assuming grams`);
    return quantity;
  }
  
  return quantity * conversionFactor;
}

/**
 * Parses a serving size string to extract grams
 * Examples: "100g", "1 cup (240g)", "3.5 oz"
 * 
 * Requirements: 3.3
 * 
 * @param servingSize - Serving size description
 * @returns Grams value or null if parsing fails
 */
export function parseServingToGrams(servingSize: string): number | null {
  // Try to extract numeric value and unit
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(g|gram|grams)/i,
    /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)/i,
    /(\d+(?:\.\d+)?)\s*(ml|milliliter|milliliters)/i,
    /(\d+(?:\.\d+)?)\s*(cup|cups)/i,
    /(\d+(?:\.\d+)?)\s*(tbsp|tablespoon|tablespoons)/i,
    /(\d+(?:\.\d+)?)\s*(tsp|teaspoon|teaspoons)/i,
  ];
  
  for (const pattern of patterns) {
    const match = servingSize.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      return convertToGrams(value, unit);
    }
  }
  
  // Try to extract just a number (assume grams)
  const numberMatch = servingSize.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  return null;
}

/**
 * Calculates scale factor to convert FatSecret serving to ingredient quantity
 * 
 * Requirements: 3.2, 3.3, 4.1
 * 
 * @param ingredientQuantity - Ingredient quantity value
 * @param ingredientUnit - Ingredient unit
 * @param servingSize - FatSecret serving size description
 * @returns Scale factor to multiply nutrition values by
 */
export function calculateScaleFactor(
  ingredientQuantity: number,
  ingredientUnit: string,
  servingSize: string
): number {
  // Convert ingredient quantity to grams
  const ingredientGrams = convertToGrams(ingredientQuantity, ingredientUnit);
  
  // Parse FatSecret serving size to grams
  const servingGrams = parseServingToGrams(servingSize);
  
  if (!servingGrams || servingGrams === 0) {
    console.warn(`Could not parse serving size: "${servingSize}", using 1:1 scale`);
    return 1;
  }
  
  return ingredientGrams / servingGrams;
}

/**
 * Looks up nutritional information for an ingredient with fallback chain
 * 
 * Requirements: 2.2, 3.2, 3.3, 4.1
 * 
 * @param ingredient - Ingredient object with name, quantity, unit, and optional preparation
 * @returns Enriched ingredient with nutrition data or null if lookup fails
 */
export async function lookupIngredientNutrition(
  ingredient: {
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
  }
): Promise<{
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  servingUnit: string;
  scaledNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  isUSDAFallback?: boolean;
} | null> {
  try {
    // Try FatSecret search with alternatives
    const foodId = await searchFatSecretFoodWithAlternatives(
      ingredient.name,
      ingredient.preparation
    );
    
    if (foodId) {
      // Get nutrition data from FatSecret
      const nutrition = await getFatSecretNutrition(foodId);
      
      if (nutrition) {
        // Calculate scale factor
        const scaleFactor = calculateScaleFactor(
          ingredient.quantity,
          ingredient.unit,
          nutrition.servingSize
        );
        
        // Scale nutrition values
        const scaledNutrition = {
          calories: Math.round(nutrition.calories * scaleFactor),
          protein: Math.round(nutrition.protein * scaleFactor * 10) / 10,
          carbs: Math.round(nutrition.carbs * scaleFactor * 10) / 10,
          fat: Math.round(nutrition.fat * scaleFactor * 10) / 10,
        };
        
        return {
          ...nutrition,
          scaledNutrition,
        };
      }
    }
    
    // Fallback to USDA if FatSecret fails
    console.warn(`FatSecret lookup failed for "${ingredient.name}", using USDA fallback`);
    const ingredientGrams = convertToGrams(ingredient.quantity, ingredient.unit);
    const usdaData = getUSDAFallback(ingredient.name, ingredientGrams);
    
    return {
      ...usdaData,
      scaledNutrition: {
        calories: usdaData.calories,
        protein: usdaData.protein,
        carbs: usdaData.carbs,
        fat: usdaData.fat,
      },
    };
  } catch (error) {
    console.error(`Ingredient nutrition lookup failed for "${ingredient.name}":`, error);
    
    // Last resort: USDA fallback
    const ingredientGrams = convertToGrams(ingredient.quantity, ingredient.unit);
    const usdaData = getUSDAFallback(ingredient.name, ingredientGrams);
    
    return {
      ...usdaData,
      scaledNutrition: {
        calories: usdaData.calories,
        protein: usdaData.protein,
        carbs: usdaData.carbs,
        fat: usdaData.fat,
      },
    };
  }
}

// ============================================================================
// Batched Nutrition Lookup
// ============================================================================

/**
 * Looks up nutritional information for multiple ingredients in batches
 * Processes ingredients in groups to manage rate limiting and improve performance
 * 
 * Requirements: 3.5, 8.3
 * 
 * @param ingredients - Array of ingredients to look up
 * @param batchSize - Number of ingredients to process concurrently (default: 5)
 * @returns Array of enriched ingredients with nutrition data
 */
export async function batchLookupNutrition(
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
    regionId: string;
    confidence: number;
  }>,
  batchSize: number = 5
): Promise<Array<{
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  regionId: string;
  confidence: number;
  nutrition: {
    foodId: string;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
    servingUnit: string;
  };
  scaledNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  isUSDAFallback?: boolean;
}>> {
  const enrichedIngredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
    regionId: string;
    confidence: number;
    nutrition: {
      foodId: string;
      foodName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      servingSize: string;
      servingUnit: string;
    };
    scaledNutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    isUSDAFallback?: boolean;
  }> = [];

  // Process ingredients in batches
  for (let i = 0; i < ingredients.length; i += batchSize) {
    const batch = ingredients.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ingredients.length / batchSize)}`);
    
    // Process batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(async (ingredient) => {
        const nutrition = await lookupIngredientNutrition(ingredient);
        
        if (!nutrition) {
          throw new Error(`Failed to lookup nutrition for "${ingredient.name}"`);
        }
        
        return {
          ...ingredient,
          nutrition: {
            foodId: nutrition.foodId,
            foodName: nutrition.foodName,
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            servingSize: nutrition.servingSize,
            servingUnit: nutrition.servingUnit,
          },
          scaledNutrition: nutrition.scaledNutrition,
          isUSDAFallback: nutrition.isUSDAFallback,
        };
      })
    );
    
    // Collect successful results and log failures
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      
      if (result.status === 'fulfilled') {
        enrichedIngredients.push(result.value);
      } else {
        const failedIngredient = batch[j];
        console.error(
          `Failed to enrich ingredient "${failedIngredient.name}":`,
          result.reason
        );
        
        // Add a minimal fallback entry to avoid losing the ingredient
        const ingredientGrams = convertToGrams(
          failedIngredient.quantity,
          failedIngredient.unit
        );
        const fallback = getUSDAFallback(failedIngredient.name, ingredientGrams);
        
        enrichedIngredients.push({
          ...failedIngredient,
          nutrition: {
            foodId: fallback.foodId,
            foodName: fallback.foodName,
            calories: fallback.calories,
            protein: fallback.protein,
            carbs: fallback.carbs,
            fat: fallback.fat,
            servingSize: fallback.servingSize,
            servingUnit: fallback.servingUnit,
          },
          scaledNutrition: {
            calories: fallback.calories,
            protein: fallback.protein,
            carbs: fallback.carbs,
            fat: fallback.fat,
          },
          isUSDAFallback: true,
        });
      }
    }
  }

  return enrichedIngredients;
}

/**
 * Looks up nutritional information for multiple ingredients with progress tracking
 * 
 * Requirements: 3.5, 8.3, 8.4
 * 
 * @param ingredients - Array of ingredients to look up
 * @param onProgress - Callback for progress updates (current, total)
 * @param batchSize - Number of ingredients to process concurrently (default: 5)
 * @returns Array of enriched ingredients with nutrition data
 */
export async function batchLookupNutritionWithProgress(
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
    regionId: string;
    confidence: number;
  }>,
  onProgress?: (current: number, total: number) => void,
  batchSize: number = 5
): Promise<Array<{
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  regionId: string;
  confidence: number;
  nutrition: {
    foodId: string;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
    servingUnit: string;
  };
  scaledNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  isUSDAFallback?: boolean;
}>> {
  const enrichedIngredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
    regionId: string;
    confidence: number;
    nutrition: {
      foodId: string;
      foodName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      servingSize: string;
      servingUnit: string;
    };
    scaledNutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    isUSDAFallback?: boolean;
  }> = [];

  let processedCount = 0;
  const totalCount = ingredients.length;

  // Process ingredients in batches
  for (let i = 0; i < ingredients.length; i += batchSize) {
    const batch = ingredients.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(async (ingredient) => {
        const nutrition = await lookupIngredientNutrition(ingredient);
        
        if (!nutrition) {
          throw new Error(`Failed to lookup nutrition for "${ingredient.name}"`);
        }
        
        return {
          ...ingredient,
          nutrition: {
            foodId: nutrition.foodId,
            foodName: nutrition.foodName,
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            servingSize: nutrition.servingSize,
            servingUnit: nutrition.servingUnit,
          },
          scaledNutrition: nutrition.scaledNutrition,
          isUSDAFallback: nutrition.isUSDAFallback,
        };
      })
    );
    
    // Collect successful results and log failures
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      
      if (result.status === 'fulfilled') {
        enrichedIngredients.push(result.value);
      } else {
        const failedIngredient = batch[j];
        
        // Add a minimal fallback entry
        const ingredientGrams = convertToGrams(
          failedIngredient.quantity,
          failedIngredient.unit
        );
        const fallback = getUSDAFallback(failedIngredient.name, ingredientGrams);
        
        enrichedIngredients.push({
          ...failedIngredient,
          nutrition: {
            foodId: fallback.foodId,
            foodName: fallback.foodName,
            calories: fallback.calories,
            protein: fallback.protein,
            carbs: fallback.carbs,
            fat: fallback.fat,
            servingSize: fallback.servingSize,
            servingUnit: fallback.servingUnit,
          },
          scaledNutrition: {
            calories: fallback.calories,
            protein: fallback.protein,
            carbs: fallback.carbs,
            fat: fallback.fat,
          },
          isUSDAFallback: true,
        });
      }
      
      processedCount++;
      onProgress?.(processedCount, totalCount);
    }
  }

  return enrichedIngredients;
}
