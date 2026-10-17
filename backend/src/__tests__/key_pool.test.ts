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
});
