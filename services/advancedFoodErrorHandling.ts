/**
 * Advanced Food Analysis Error Handling Module
 * 
 * Provides comprehensive error handling with retry logic, exponential backoff,
 * timeout management, and user-friendly error messages.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.5
 */

// ============================================================================
// Error Types and Configuration
// ============================================================================

/**
 * Error categories for different failure scenarios
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  API_KEY = 'API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  NO_FOOD_DETECTED = 'NO_FOOD_DETECTED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY_MS: 2000, // 2 seconds
  MAX_DELAY_MS: 16000, // 16 seconds
  BACKOFF_MULTIPLIER: 2, // Exponential backoff: 2s, 4s, 8s, 16s
  TIMEOUT_MS: 120000, // 120 seconds per request (increased for Gemini rate limits)
};

/**
 * Custom error class for advanced food analysis
 */
export class AdvancedFoodAnalysisError extends Error {
  category: ErrorCategory;
  originalError?: Error;
  retryable: boolean;
  userMessage: string;

  constructor(
    message: string,
    category: ErrorCategory,
    userMessage: string,
    retryable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AdvancedFoodAnalysisError';
    this.category = category;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classifies an error into a specific category
 * 
 * @param error - Error to classify
 * @returns Error category
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) {
    return ErrorCategory.UNKNOWN;
  }

  const message = error.message.toLowerCase();

  // API key errors
  if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) {
    return ErrorCategory.API_KEY;
  }

  // Rate limiting errors
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('resource exhausted')
  ) {
    return ErrorCategory.RATE_LIMIT;
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return ErrorCategory.TIMEOUT;
  }

  // Parsing errors
  if (message.includes('parse') || message.includes('json') || message.includes('invalid response')) {
    return ErrorCategory.PARSING;
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid data')) {
    return ErrorCategory.VALIDATION;
  }

  // No food detected
  if (message.includes('no food') || message.includes('not detected')) {
    return ErrorCategory.NO_FOOD_DETECTED;
  }

  // Insufficient data
  if (message.includes('insufficient') || message.includes('no ingredients') || message.includes('no nutrition')) {
    return ErrorCategory.INSUFFICIENT_DATA;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determines if an error is retryable
 * 
 * @param category - Error category
 * @returns true if error is retryable
 */
export function isRetryableError(category: ErrorCategory): boolean {
  return [
    ErrorCategory.NETWORK,
    ErrorCategory.RATE_LIMIT,
    ErrorCategory.TIMEOUT,
  ].includes(category);
}

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

/**
 * Gets a user-friendly error message for a given error category
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5
 * 
 * @param category - Error category
 * @param context - Optional context for more specific messages
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(
  category: ErrorCategory,
  context?: {
    stage?: string;
    retryCount?: number;
    maxRetries?: number;
  }
): string {
  const stage = context?.stage ? ` during ${context.stage}` : '';
  const retryInfo = context?.retryCount !== undefined && context?.maxRetries !== undefined
    ? ` (attempt ${context.retryCount + 1}/${context.maxRetries})`
    : '';

  switch (category) {
    case ErrorCategory.API_KEY:
      return 'API configuration error. Please contact support to resolve this issue.';

    case ErrorCategory.RATE_LIMIT:
      return `Service temporarily unavailable due to high demand${stage}. Please try again in a few moments.`;

    case ErrorCategory.NETWORK:
      return `Network error${stage}. Please check your internet connection and try again.`;

    case ErrorCategory.TIMEOUT:
      return `Request timed out${stage}${retryInfo}. Please try again with a smaller or clearer image.`;

    case ErrorCategory.PARSING:
      return `Failed to process the analysis results${stage}. Please try again with a different photo.`;

    case ErrorCategory.VALIDATION:
      return `The analysis results appear inconsistent${stage}. Please try again with a clearer photo.`;

    case ErrorCategory.NO_FOOD_DETECTED:
      return 'No food items detected in the image. Please try a clearer photo with better lighting and a closer view of the food.';

    case ErrorCategory.INSUFFICIENT_DATA:
      return `Could not retrieve sufficient nutritional data${stage}. Please check your internet connection and try again.`;

    case ErrorCategory.UNKNOWN:
    default:
      return `An unexpected error occurred${stage}. Please try again. If the problem persists, contact support.`;
  }
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * Requirements: 6.1, 6.4, 8.5
 * 
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function
 * @throws AdvancedFoodAnalysisError if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? RETRY_CONFIG.MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? RETRY_CONFIG.INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? RETRY_CONFIG.MAX_DELAY_MS;
  const backoffMultiplier = options.backoffMultiplier ?? RETRY_CONFIG.BACKOFF_MULTIPLIER;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const category = classifyError(lastError);
      const shouldRetry = options.shouldRetry
        ? options.shouldRetry(lastError)
        : isRetryableError(category);

      // If this is the last attempt or error is not retryable, throw
      if (attempt === maxRetries || !shouldRetry) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      // Notify about retry
      console.warn(
        `Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
        `Retrying in ${delayMs}ms...`
      );

      options.onRetry?.(lastError, attempt);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error during retry');
}

// ============================================================================
// Timeout Handling
// ============================================================================

/**
 * Wraps a promise with a timeout
 * 
 * Requirements: 6.5, 8.5
 * 
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 * @returns Promise that rejects if timeout occurs
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = RETRY_CONFIG.TIMEOUT_MS,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AdvancedFoodAnalysisError(
        errorMessage,
        ErrorCategory.TIMEOUT,
        getUserFriendlyErrorMessage(ErrorCategory.TIMEOUT),
        true
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ============================================================================
// Error Handling Wrapper
// ============================================================================

/**
 * Wraps a function with comprehensive error handling
 * Includes retry logic, timeout handling, and user-friendly error messages
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.5
 * 
 * @param fn - Async function to wrap
 * @param options - Error handling options
 * @returns Result of the function or throws AdvancedFoodAnalysisError
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: {
    stage?: string;
    maxRetries?: number;
    timeoutMs?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  try {
    // Wrap with retry logic, ensuring timeout is applied to each attempt
    return await withRetry(
      async () => {
        return withTimeout(
          fn(),
          options.timeoutMs,
          `Operation timed out${options.stage ? ` during ${options.stage}` : ''}`
        );
      },
      {
        maxRetries: options.maxRetries,
        onRetry: options.onRetry,
      }
    );
  } catch (error) {
    // If already an AdvancedFoodAnalysisError, rethrow
    if (error instanceof AdvancedFoodAnalysisError) {
      throw error;
    }

    // Classify and wrap the error
    const category = classifyError(error);
    const userMessage = getUserFriendlyErrorMessage(category, { stage: options.stage });

    throw new AdvancedFoodAnalysisError(
      error instanceof Error ? error.message : String(error),
      category,
      userMessage,
      isRetryableError(category),
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// Stage-Specific Error Handlers
// ============================================================================

/**
 * Handles errors during image segmentation stage
 * 
 * @param error - Error that occurred
 * @returns Fallback segmentation result or throws
 */
export function handleSegmentationError(error: unknown): {
  regions: Array<{
    description: string;
    confidence: number;
  }>;
  overallConfidence: number;
  notes: string;
} {
  console.error('Segmentation error:', error);

  const category = classifyError(error);

  // For certain errors, provide a fallback (treat entire image as single region)
  if (category === ErrorCategory.PARSING || category === ErrorCategory.TIMEOUT) {
    console.warn('Segmentation failed, treating entire image as single region');
    return {
      regions: [{
        description: 'Entire image (segmentation failed)',
        confidence: 40,
      }],
      overallConfidence: 40,
      notes: 'Segmentation failed, processed entire image as single region',
    };
  }

  // For other errors, rethrow as AdvancedFoodAnalysisError
  throw new AdvancedFoodAnalysisError(
    error instanceof Error ? error.message : String(error),
    category,
    getUserFriendlyErrorMessage(category, { stage: 'image segmentation' }),
    isRetryableError(category),
    error instanceof Error ? error : undefined
  );
}

/**
 * Handles errors during ingredient decomposition stage
 * 
 * @param error - Error that occurred
 * @param regionDescription - Description of the region that failed
 * @returns Fallback ingredient or null
 */
export function handleDecompositionError(
  error: unknown,
  regionDescription: string
): {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
} | null {
  console.error(`Decomposition error for region:`, error);

  const category = classifyError(error);

  // For parsing errors, provide a fallback ingredient
  if (category === ErrorCategory.PARSING) {
    console.warn(`Decomposition failed for region, using fallback`);
    return {
      name: regionDescription || 'unknown food',
      quantity: 100,
      unit: 'g',
      confidence: 30,
    };
  }

  // For retryable errors, return null to allow retry
  if (isRetryableError(category)) {
    return null;
  }

  // For other errors, provide fallback
  return {
    name: regionDescription || 'unknown food',
    quantity: 100,
    unit: 'g',
    confidence: 30,
  };
}

/**
 * Handles errors during nutritional lookup stage
 * 
 * @param error - Error that occurred
 * @param ingredientName - Ingredient name that failed
 * @returns true if should retry, false if should use fallback
 */
export function handleLookupError(error: unknown, ingredientName: string): boolean {
  console.error(`Lookup error for ingredient "${ingredientName}":`, error);

  const category = classifyError(error);

  // Retry for network and rate limit errors
  if (category === ErrorCategory.NETWORK || category === ErrorCategory.RATE_LIMIT) {
    return true;
  }

  // Use fallback for other errors
  return false;
}

// ============================================================================
// Error Logging and Reporting
// ============================================================================

/**
 * Logs error details for debugging and monitoring
 * 
 * @param error - Error to log
 * @param context - Additional context
 */
export function logError(
  error: unknown,
  context: {
    stage?: string;
    userId?: string;
    imageUri?: string;
    timestamp?: number;
  } = {}
): void {
  const category = classifyError(error);
  const message = error instanceof Error ? error.message : String(error);

  console.error('Advanced Food Analysis Error:', {
    category,
    message,
    stage: context.stage,
    timestamp: context.timestamp || Date.now(),
    retryable: isRetryableError(category),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // In production, you might want to send this to an error tracking service
  // e.g., Sentry, LogRocket, etc.
}

/**
 * Gets retry configuration for testing or customization
 * 
 * @returns Current retry configuration
 */
export function getRetryConfig() {
  return { ...RETRY_CONFIG };
}
