import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiService } from '../services/gemini.service.js';

describe('Gemini Multi-API-Key Pool & Auto-Failover', () => {
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
});
