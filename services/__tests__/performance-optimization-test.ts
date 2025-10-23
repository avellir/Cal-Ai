/**
 * Manual test script for performance optimization features
 * Tests caching system and request queue optimization
 * 
 * Run with: npx ts-node services/__tests__/performance-optimization-test.ts
 */

import {
    getFatSecretQueue,
    getIngredientSearchCache,
    searchFatSecretFood,
    searchFatSecretFoodWithAlternatives,
} from '../fatSecretApi';

/**
 * Test 1: Ingredient Search Cache
 */
async function testIngredientSearchCache() {
  console.log('\n=== Test 1: Ingredient Search Cache ===\n');

  const cache = getIngredientSearchCache();

  // Clear cache to start fresh
  cache.clear();
  console.log('✓ Cache cleared');

  // Check initial stats
  let stats = cache.stats;
  console.log(`Initial cache size: ${stats.size}/${stats.maxSize}`);
  console.log(`Cache TTL: ${stats.ttlMs}ms (${stats.ttlMs / 1000 / 60} minutes)`);

  // Test cache miss (first search)
  console.log('\n--- Testing cache miss ---');
  const startTime1 = Date.now();
  const result1 = await searchFatSecretFood('chicken breast');
  const duration1 = Date.now() - startTime1;
  console.log(`First search for "chicken breast": ${result1 ? 'Found' : 'Not found'}`);
  console.log(`Duration: ${duration1}ms`);

  // Test cache hit (second search)
  console.log('\n--- Testing cache hit ---');
  const startTime2 = Date.now();
  const result2 = await searchFatSecretFood('chicken breast');
  const duration2 = Date.now() - startTime2;
  console.log(`Second search for "chicken breast": ${result2 ? 'Found' : 'Not found'}`);
  console.log(`Duration: ${duration2}ms`);
  console.log(`Speed improvement: ${Math.round((duration1 - duration2) / duration1 * 100)}%`);

  // Check cache stats
  stats = cache.stats;
  console.log(`\nCache size after searches: ${stats.size}/${stats.maxSize}`);

  // Test cache with multiple ingredients
  console.log('\n--- Testing multiple ingredients ---');
  const ingredients = ['white rice', 'broccoli', 'olive oil', 'soy sauce'];
  
  for (const ingredient of ingredients) {
    await searchFatSecretFood(ingredient);
  }

  stats = cache.stats;
  console.log(`Cache size after ${ingredients.length} more searches: ${stats.size}/${stats.maxSize}`);

  // Test cache invalidation
  console.log('\n--- Testing cache invalidation ---');
  const invalidated = cache.invalidatePattern(/chicken/);
  console.log(`Invalidated ${invalidated} entries matching /chicken/`);
  
  stats = cache.stats;
  console.log(`Cache size after invalidation: ${stats.size}/${stats.maxSize}`);

  // Test cache expiration cleanup
  console.log('\n--- Testing expired entry cleanup ---');
  const expired = cache.cleanExpired();
  console.log(`Cleaned ${expired} expired entries`);

  console.log('\n✓ Cache tests completed successfully\n');
}

/**
 * Test 2: Request Queue Optimization
 */
async function testRequestQueue() {
  console.log('\n=== Test 2: Request Queue Optimization ===\n');

  const queue = getFatSecretQueue();

  // Reset stats
  queue.resetStats();
  console.log('✓ Queue stats reset');

  // Check initial configuration
  let stats = queue.stats;
  console.log('\nInitial queue configuration:');
  console.log(`  Delay between requests: ${stats.config.delayMs}ms`);
  console.log(`  Max concurrent requests: ${stats.config.maxConcurrent}`);
  console.log(`  Max retries: ${stats.config.maxRetries}`);
  console.log(`  Retry delay: ${stats.config.retryDelayMs}ms`);

  // Test queue processing
  console.log('\n--- Testing queue processing ---');
  const ingredients = ['chicken', 'rice', 'broccoli', 'carrot', 'onion'];
  
  const startTime = Date.now();
  const promises = ingredients.map(ing => searchFatSecretFood(ing));
  
  // Check queue status while processing
  setTimeout(() => {
    const currentStats = getFatSecretQueue().stats;
    console.log(`Queue status during processing:`);
    console.log(`  Queue length: ${currentStats.queueLength}`);
    console.log(`  Active requests: ${currentStats.activeRequests}`);
    console.log(`  Is processing: ${currentStats.isProcessing}`);
  }, 100);

  await Promise.all(promises);
  const duration = Date.now() - startTime;

  console.log(`\nProcessed ${ingredients.length} requests in ${duration}ms`);
  console.log(`Average time per request: ${Math.round(duration / ingredients.length)}ms`);

  // Check final stats
  stats = queue.stats;
  console.log('\nFinal queue statistics:');
  console.log(`  Total processed: ${stats.totalProcessed}`);
  console.log(`  Total errors: ${stats.totalErrors}`);
  console.log(`  Total retries: ${stats.totalRetries}`);
  console.log(`  Queue length: ${stats.queueLength}`);
  console.log(`  Active requests: ${stats.activeRequests}`);

  // Test queue configuration update
  console.log('\n--- Testing queue configuration update ---');
  queue.updateConfig({ delayMs: 100 });
  stats = queue.stats;
  console.log(`Updated delay to: ${stats.config.delayMs}ms`);

  console.log('\n✓ Queue tests completed successfully\n');
}

/**
 * Test 3: Alternative Search with Caching
 */
async function testAlternativeSearchWithCaching() {
  console.log('\n=== Test 3: Alternative Search with Caching ===\n');

  const cache = getIngredientSearchCache();
  cache.clear();

  // Test alternative search (first time - cache miss)
  console.log('--- Testing alternative search (cache miss) ---');
  const startTime1 = Date.now();
  const result1 = await searchFatSecretFoodWithAlternatives('chicken breast', 'grilled');
  const duration1 = Date.now() - startTime1;
  console.log(`First search with alternatives: ${result1 ? 'Found' : 'Not found'}`);
  console.log(`Duration: ${duration1}ms`);

  // Test alternative search (second time - cache hit)
  console.log('\n--- Testing alternative search (cache hit) ---');
  const startTime2 = Date.now();
  const result2 = await searchFatSecretFoodWithAlternatives('chicken breast', 'grilled');
  const duration2 = Date.now() - startTime2;
  console.log(`Second search with alternatives: ${result2 ? 'Found' : 'Not found'}`);
  console.log(`Duration: ${duration2}ms`);
  console.log(`Speed improvement: ${Math.round((duration1 - duration2) / duration1 * 100)}%`);

  const stats = cache.stats;
  console.log(`\nCache size: ${stats.size}/${stats.maxSize}`);

  console.log('\n✓ Alternative search tests completed successfully\n');
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Performance Optimization Tests                            ║');
  console.log('║  Testing caching system and request queue optimization     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Run all tests
    await testIngredientSearchCache();
    await testRequestQueue();
    await testAlternativeSearchWithCaching();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ All tests completed successfully!                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n✗ Test failed with error:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runTests };
