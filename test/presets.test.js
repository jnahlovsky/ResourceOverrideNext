import { describe, it, expect } from 'vitest';
import { mergePresetRules, presetName } from '../src/lib/presets.js';

const own = (id) => ({ id, type: 'normalOverride', name: id, on: true });
const fromFile = (name, id, on = true) => ({ id, type: 'normalOverride', name, on });

describe('team presets', () => {
    it('adds a new preset at the end, tagged with its URL', () => {
        const rules = mergePresetRules([own('a')], 'https://x/team.json', [fromFile('API', 'n1')]);
        expect(rules.map(r => r.id)).toEqual(['a', 'n1']);
        expect(rules[1]).toMatchObject({ presetUrl: 'https://x/team.json', presetKey: 'normalOverride:API:1' });
    });

    it('replaces the preset in place and keeps ids and on/off switches', () => {
        const before = mergePresetRules([own('a'), own('b')], 'u', [fromFile('API', 'n1'), fromFile('CDN', 'n2')]);
        const moved = [before[0], before[2], before[3], before[1]]; // the user put own rule b last
        moved[1] = { ...moved[1], on: false };                       // and switched API off
        const after = mergePresetRules(moved, 'u', [fromFile('API', 'x1'), fromFile('New', 'x3')]);
        expect(after.map(r => r.id)).toEqual(['a', 'n1', 'x3', 'b']);
        expect(after[1].on).toBe(false);
    });

    it('names a preset after its file', () => {
        expect(presetName('https://gist.githubusercontent.com/me/abc/raw/team-rules.json')).toBe('team-rules.json');
        expect(presetName('https://rules.example.com/')).toBe('rules.example.com');
    });
});
