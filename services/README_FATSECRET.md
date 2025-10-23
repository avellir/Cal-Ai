# FatSecret Platform API Integration

This module provides OAuth 2.0 authentication, token management, and request queue functionality for the FatSecret Platform API.

## Setup

### 1. Get FatSecret API Credentials

1. Visit [FatSecret Platform](https://platform.fatsecret.com/api/)
2. Create a free account
3. Create a new application
4. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
EXPO_PUBLIC_FATSECRET_CLIENT_ID=your_client_id_here
EXPO_PUBLIC_FATSECRET_CLIENT_SECRET=your_client_secret_here
```

## Usage

### Basic Authentication

```typescript
import { getFatSecretAccessToken } from '@/services/fatSecretApi';

// Get an access token (automatically cached and refreshed)
const token = await getFatSecretAccessToken();
```

### Making API Requests

```typescript
import { makeFatSecretRequest } from '@/services/fatSecretApi';

// Search for food items
const searchResults = await makeFatSecretRequest('foods.search', {
  search_expression: 'chicken breast',
  max_results: '5',
});

// Get detailed food information
const foodDetails = await makeFatSecretRequest('food.get.v2', {
  food_id: '12345',
});
```

### Request Queue Management

The module automatically manages rate limiting with a request queue:

```typescript
import { getFatSecretQueue } from '@/services/fatSecretApi';

// Check queue status
const status = getFatSecretQueue();
console.log(`Queue length: ${status.queueLength}`);
console.log(`Processing: ${status.isProcessing}`);
```

### Configuration Validation

```typescript
import { 
  isFatSecretConfigured, 
  testFatSecretConnection 
} from '@/services/fatSecretApi';

// Check if credentials are configured
if (!isFatSecretConfigured()) {
  console.error('FatSecret credentials not configured');
}

// Test API connection
const isConnected = await testFatSecretConnection();
if (!isConnected) {
  console.error('Failed to connect to FatSecret API');
}
```

## Features

### ✅ OAuth 2.0 Client Credentials Flow
- Automatic token acquisition
- Token caching with expiration handling
- Automatic token refresh (1 minute before expiry)

### ✅ Request Queue System
- Sequential request processing
- Configurable delay between requests (default: 200ms)
- Prevents rate limit violations
- Handles up to ~18,000 requests/hour

### ✅ Error Handling
- Exponential backoff for rate limits (1s, 2s, 4s)
- Automatic token refresh on 401 errors
- Up to 3 retry attempts for failed requests
- User-friendly error messages

### ✅ Rate Limiting
- Free tier: 5,000 requests/day
- Automatic queue management
- Configurable delay between requests

## API Methods

Common FatSecret Platform API methods:

- `foods.search` - Search for food items
- `food.get.v2` - Get detailed food information
- `foods.autocomplete` - Get autocomplete suggestions
- `recipes.search` - Search for recipes

See [FatSecret API Documentation](https://platform.fatsecret.com/api/Default.aspx?screen=rapiref2) for full method list.

## Error Handling

The module throws descriptive errors for common issues:

```typescript
try {
  const token = await getFatSecretAccessToken();
} catch (error) {
  // Possible errors:
  // - "FatSecret API credentials not configured..."
  // - "Failed to authenticate with FatSecret API..."
  // - "FatSecret API error: 429 Rate limit exceeded"
  console.error(error.message);
}
```

## Implementation Details

### Token Caching
- Tokens are cached in memory
- Automatically refreshed 1 minute before expiration
- Cleared on authentication errors

### Request Queue
- FIFO (First In, First Out) processing
- 200ms delay between requests (configurable)
- Processes requests sequentially to avoid rate limits
- Non-blocking - returns promises immediately

### Retry Logic
- Rate limits (429): 3 retries with exponential backoff
- Auth errors (401): 1 retry after token refresh
- Other errors: No retry, immediate failure

## Requirements Satisfied

- ✅ **Requirement 3.1**: OAuth 2.0 authentication with token caching
- ✅ **Requirement 6.1**: Graceful API failure handling with fallbacks
- ✅ **Requirement 8.3**: Request queue for rate limiting management
