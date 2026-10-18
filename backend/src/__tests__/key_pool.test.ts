import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { GeminiService } from '../services/gemini.service.js';

describe('Gemini Multi-API-Key Pool & Auto-Failover', () => {
  beforeAll(async () => {
    await runMigrations();
  });
  it('correctly parses multiple keys separated by newlines, commas, and semicolons', () => {
    const rawKeys = `
      AIzaSyKeyOne_11111111111111111111
      AIzaSyKeyTwo_22222222222222222222, AIzaSyKeyThree_3333333333333333
      # This is a comment
      AIzaSyKeyFour_4444444444444444;AIzaSyKeyFive_5555555555555555
    `;

    const parsed = GeminiService.parseKeys(rawKeys);
    expect(parsed).toHaveLength(5);
    expect(parsed[0]).toBe('AIzaSyKeyOne_11111111111111111111');
    expect(parsed[1]).toBe('AIzaSyKeyTwo_22222222222222222222');
    expect(parsed[2]).toBe('AIzaSyKeyThree_3333333333333333');
    expect(parsed[3]).toBe('AIzaSyKeyFour_4444444444444444');
    expect(parsed[4]).toBe('AIzaSyKeyFive_5555555555555555');
  });

  it('correctly masks keys for secure frontend presentation', () => {
    const key = 'AIzaSyA1234567890BCDEF';
    const masked = GeminiService.maskKey(key);
    expect(masked).toBe('AIzaSy...CDEF');
  });

  it('correctly identifies failover error candidates (429, 503, 403, network failure)', () => {
    expect(GeminiService.isFailoverError({ status: 429, message: 'Resource exhausted' })).toBe(true);
    expect(GeminiService.isFailoverError({ status: 503, message: 'The model is overloaded' })).toBe(true);
    expect(GeminiService.isFailoverError({ status: 403, message: 'API key not valid' })).toBe(true);
    expect(GeminiService.isFailoverError({ message: 'fetch failed: ECONNRESET' })).toBe(true);
    expect(GeminiService.isFailoverError({ message: 'Quota exceeded for quota metric' })).toBe(true);

    // Non-failover client prompt errors shouldn't failover keys unnecessarily
    expect(GeminiService.isFailoverError({ status: 400, message: 'Invalid argument provided' })).toBe(false);
  });

  it('correctly removes a key by index and clears all keys', async () => {
    await GeminiService.updateAiConfig({
      apiKey: 'AIzaSyKeyA_111111111111\nAIzaSyKeyB_222222222222\nAIzaSyKeyC_333333333333',
    });

    let summary = GeminiService.getAiConfigSummary();
    expect(summary.keyCount).toBe(3);

    // Delete middle key (index 2)
    await GeminiService.removeKeyByIndex(2);
    summary = GeminiService.getAiConfigSummary();
    expect(summary.keyCount).toBe(2);
    expect(summary.keyPool[0].maskedKey).toBe('AIzaSy...1111');
    expect(summary.keyPool[1].maskedKey).toBe('AIzaSy...3333');

    // Clear all keys
    await GeminiService.clearAllKeys();
    summary = GeminiService.getAiConfigSummary();
    expect(summary.keyCount).toBe(0);
    expect(summary.hasApiKey).toBe(false);
    expect(summary.isLiveConfigured).toBe(false);
  });

  it('tracks token consumption for individual API keys and calculates system-wide totals & percentages', async () => {
    await GeminiService.resetTokenUsageStats();

    const key1 = 'AIzaSyTokenTestKey1_1111111111';
    const key2 = 'AIzaSyTokenTestKey2_2222222222';

    await GeminiService.updateAiConfig({
      apiKey: `${key1}\n${key2}`,
    });

    // Record usage for key 1: 300 prompt tokens, 700 output tokens = 1000 tokens
    await GeminiService.recordKeyUsage({
      key: key1,
      promptTokens: 300,
      outputTokens: 700,
      success: true,
    });

    // Record usage for key 2: 600 prompt tokens, 1400 output tokens = 2000 tokens
    await GeminiService.recordKeyUsage({
      key: key2,
      promptTokens: 600,
      outputTokens: 1400,
      success: true,
    });

    // Record one failed attempt on key 1 (e.g. rate limit error)
    await GeminiService.recordKeyUsage({
      key: key1,
      promptTokens: 0,
      outputTokens: 0,
      success: false,
    });

    const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
    const summary = GeminiService.getAiConfigSummary(keyUsageMap, tokenStats);

    // Verify system-wide totals
    expect(tokenStats.totalTokens).toBe(3000);
    expect(tokenStats.totalPromptTokens).toBe(900);
    expect(tokenStats.totalOutputTokens).toBe(2100);
    expect(tokenStats.totalRequests).toBe(3);
    expect(tokenStats.totalSuccessRequests).toBe(2);
    expect(tokenStats.totalErrorRequests).toBe(1);
    expect(tokenStats.avgTokensPerRequest).toBe(1000);

    // Verify individual key 1 stats
    const k1Stats = summary.keyPool.find((k) => k.maskedKey === GeminiService.maskKey(key1));
    expect(k1Stats).toBeDefined();
    expect(k1Stats?.totalTokens).toBe(1000);
    expect(k1Stats?.promptTokens).toBe(300);
    expect(k1Stats?.outputTokens).toBe(700);
    expect(k1Stats?.requestCount).toBe(2);
    expect(k1Stats?.successCount).toBe(1);
    expect(k1Stats?.errorCount).toBe(1);
    // Key 1 is 1000/3000 = 33.3%
    expect(k1Stats?.percentShare).toBe(33.3);

    // Verify individual key 2 stats
    const k2Stats = summary.keyPool.find((k) => k.maskedKey === GeminiService.maskKey(key2));
    expect(k2Stats).toBeDefined();
    expect(k2Stats?.totalTokens).toBe(2000);
    expect(k2Stats?.promptTokens).toBe(600);
    expect(k2Stats?.outputTokens).toBe(1400);
    expect(k2Stats?.requestCount).toBe(1);
    expect(k2Stats?.successCount).toBe(1);
    expect(k2Stats?.errorCount).toBe(0);
    // Key 2 is 2000/3000 = 66.7%
    expect(k2Stats?.percentShare).toBe(66.7);

    // Test Reset Token Usage
    await GeminiService.resetTokenUsageStats();
    const afterReset = await GeminiService.getKeyUsageStats();
    expect(afterReset.tokenStats.totalTokens).toBe(0);
    expect(afterReset.tokenStats.totalRequests).toBe(0);
  });
});
