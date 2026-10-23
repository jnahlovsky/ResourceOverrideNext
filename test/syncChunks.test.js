import { describe, it, expect } from 'vitest';
import { splitForSync, syncBytes, contentHash, SYNC_ITEM_BYTES } from '../src/lib/syncChunks.js';

const keyOf = (i) => `rules.${i}`;
const bytes = (s) => new TextEncoder().encode(s).length;

describe('sync chunks', () => {
    it('splits text into items under the per-item limit and joins back', () => {
        const text = JSON.stringify({ rules: Array.from({ length: 400 }, (_, i) => ({ id: i, match: `*/app${i}/**`, note: 'čšř 🚀 "quoted" \\ back' })) });
        const chunks = splitForSync(text, keyOf);
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach((chunk, i) => expect(bytes(keyOf(i)) + bytes(JSON.stringify(chunk))).toBeLessThanOrEqual(SYNC_ITEM_BYTES));
        expect(chunks.join('')).toBe(text);
        expect(syncBytes(chunks, keyOf)).toBeGreaterThan(text.length);
    });

    it('fingerprints content', () => {
        expect(contentHash('abc')).toBe(contentHash('abc'));
        expect(contentHash('abc')).not.toBe(contentHash('abd'));
    });
});
