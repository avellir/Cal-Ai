/**
 * Google Gemini API Client Service
 * 
 * Shared utility for interacting with Google's Gemini models.
 * Handles image conversion and API requests.
 * 
 * ACTUAL Free Tier Limits (as of Dec 2024):
 * - gemini-1.5-flash: 15 RPM, 1,500 requests/day (Best for dev)
 * - gemini-2.0-flash-exp (Preview): 10 RPM, 50 requests/day (Very limited daily quota!)
 * 
 * We use gemini-2.0-flash by default, but it has strict daily limits in preview.
 * Quota resets at midnight Pacific Time (PT).
 */

export type GeminiRequest = {
    apiKey: string;
    prompt: string;
    base64Image: string;
    model?: string;
    temperature?: number;
    responseSchema?: object;
    maxOutputTokens?: number;
};

// Rate Limiting Configuration
// Free Tier: 10 RPM for Flash = 1 request every 6 seconds minimum
// Using 8 seconds to be safe and account for processing time
const MIN_REQUEST_DELAY_MS = 8000;
const MAX_CONCURRENT_REQUESTS = 1;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 10000;  // Start with 10s since limits are strict

// Daily request tracking (resets on app restart, but helps with awareness)
let dailyRequestCount = 0;
let lastRequestDate = new Date().toDateString();

function trackRequest(): void {
    const today = new Date().toDateString();
    if (today !== lastRequestDate) {
        // New day, reset counter
        dailyRequestCount = 0;
        lastRequestDate = today;
    }
    dailyRequestCount++;
    console.log(`[GeminiQuota] Request #${dailyRequestCount} today (free tier limit: ~250/day)`);

    if (dailyRequestCount >= 200) {
        console.warn(`[GeminiQuota] WARNING: Approaching daily limit! ${dailyRequestCount}/250 requests used.`);
    }
}

class GeminiRequestQueue {
    private queue: (() => Promise<void>)[] = [];
    private activeRequests = 0;
    private lastRequestTime = 0;
    private requestCount = 0;

    async enqueue<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };

            this.queue.push(wrappedTask);
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.activeRequests >= MAX_CONCURRENT_REQUESTS || this.queue.length === 0) {
            return;
        }

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const timeToWait = Math.max(0, MIN_REQUEST_DELAY_MS - timeSinceLastRequest);

        if (timeToWait > 0) {
            console.log(`[GeminiQueue] Waiting ${Math.round(timeToWait / 1000)}s before next request...`);
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }

        // Re-check conditions after wait
        if (this.activeRequests >= MAX_CONCURRENT_REQUESTS || this.queue.length === 0) {
            if (this.queue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
            return;
        }

        const task = this.queue.shift();
        if (!task) return;

        this.activeRequests++;
        this.lastRequestTime = Date.now();
        this.requestCount++;
        console.log(`[GeminiQueue] Processing request #${this.requestCount}, queue size: ${this.queue.length}`);

        task().finally(() => {
            this.activeRequests--;
            this.processQueue();
        });
    }
}

const geminiQueue = new GeminiRequestQueue();

/**
 * Extracts wait seconds from rate limit error message
 */
function extractWaitSeconds(errorMessage: string): number | null {
    const match = errorMessage.match(/wait\s+(\d+)\s+seconds?/i);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Retries a function with exponential backoff
 * Uses server-suggested wait time when available
 * Detects quota exhaustion (wait > 60s) and fails fast
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    initialDelay: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Only retry on rate limit errors (429)
            const isRateLimit = lastError.message.includes('Rate limit') || lastError.message.includes('429');
            if (!isRateLimit) {
                throw lastError;
            }

            // Extract server-suggested wait time
            const serverWaitSeconds = extractWaitSeconds(lastError.message);

            // If server says wait more than 60 seconds, likely quota exhausted
            if (serverWaitSeconds && serverWaitSeconds > 60) {
                console.error(`[GeminiRetry] Quota likely exhausted. Server wants ${serverWaitSeconds}s wait.`);
                throw new Error(
                    `API quota exhausted. Please wait ${Math.ceil(serverWaitSeconds / 60)} minutes or try again tomorrow. ` +
                    `Free tier limit: ~250 requests/day.`
                );
            }

            if (attempt < maxRetries) {
                // Use server-suggested wait time + buffer, or exponential backoff
                const delay = serverWaitSeconds
                    ? (serverWaitSeconds + 3) * 1000
                    : initialDelay * Math.pow(2, attempt);

                console.log(`[GeminiRetry] Rate limited. Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error(`[GeminiRetry] All ${maxRetries} retries exhausted.`);
    throw new Error(
        'Rate limit exceeded after multiple retries. ' +
        'Please wait a few minutes before trying again, or check your API quota at https://aistudio.google.com/'
    );
}

/**
 * Runs a request to Google Gemini API with vision capabilities
 * Wrapped in a queue and retry logic for rate limit handling
 */
export async function runGeminiRequest(params: GeminiRequest): Promise<string> {
    return geminiQueue.enqueue(async () => {
        const {
            apiKey,
            prompt,
            base64Image,
            model = 'gemini-2.5-flash-lite', // Updated to 2.5-flash-lite (released July 2025)
            temperature = 0.4,
            responseSchema,
            maxOutputTokens = 2048
        } = params;

        // Track request for quota awareness
        trackRequest();

        return withRetry(async () => {
            console.log('[GeminiAPI] Calling model:', model);

            const body: any = {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Image,
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens,
                    responseMimeType: "application/json"
                },
            };

            if (responseSchema) {
                body.generationConfig.responseSchema = responseSchema;
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
                console.error(`[GeminiAPI] Error ${response.status}: ${errorMessage.substring(0, 200)}`);
                throw new Error(`Gemini API Error (${response.status}): ${errorMessage}`);
            }

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            const finishReason = result?.candidates?.[0]?.finishReason;

            if (!text) {
                throw new Error(finishReason ? `AI stopped early: ${finishReason}` : 'No response from Gemini AI');
            }

            // Check if response was truncated due to token limit
            if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
                console.warn(`[GeminiAPI] Response truncated (${finishReason}). Returning partial response for repair attempt.`);
                // Return partial response - caller can attempt JSON repair
                return sanitizeModelResponse(text);
            }

            return sanitizeModelResponse(text);
        });
    });
}

/**
 * Converts an image URI to base64 string
 */
export async function convertImageToBase64(uri: string): Promise<string> {
    try {
        console.log('Converting image to base64, URI:', uri);
        const response = await fetch(uri);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;

                if (!base64String) {
                    reject(new Error('FileReader returned null or undefined'));
                    return;
                }

                const base64 = base64String.includes(',')
                    ? base64String.split(',')[1]
                    : base64String;

                if (!base64) {
                    reject(new Error('Failed to extract base64 data from result'));
                    return;
                }

                resolve(base64);
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(error);
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Image conversion error:', error);
        throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function sanitizeModelResponse(content: string): string {
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```\n?/g, '');
    }
    return cleanedContent.trim();
}

/**
 * Helper to build parts for flexible usage if needed
 */
export function buildParts(prompt: string, base64Image: string) {
    return [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
    ];
}
