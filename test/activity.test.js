import { describe, it, expect } from 'vitest';
import { compileRules, attributeRedirect, matchHeaderRules, describeHeaderChanges, statusBucket } from '../src/lib/activity.js';

const rules = compileRules([
    { id: 'r1', type: 'normalOverride', on: true, name: 'Frontend', match: '*/app/**', replace: 'http://localhost:8782/app/**' },
    { id: 'r2', type: 'normalOverride', on: true, match: '*/api/**', replace: 'http://localhost:3000/api/**', domainFiltersOn: true, includeDomains: 'stage.example.com' },
    { id: 'r3', type: 'normalOverride', on: false, name: 'Off', match: '*/off/**', replace: 'http://localhost/off/**' },
    { id: 'r4', type: 'normalOverride', on: true, name: 'Incomplete', match: '', replace: '' },
    { id: 'f1', type: 'fileOverride', on: true, match: '*/main.css', file: 'body{}' },
    { id: 'h1', type: 'headerRule', on: true, match: '*/api/*', requestRules: [{ operation: 'set', header: 'X-Debug', value: '1' }], responseRules: [{ operation: 'remove', header: 'Set-Cookie' }] }
]);

describe('activity attribution', () => {
    it('leaves out switched-off and incomplete rules', () => {
        expect(rules.map(e => e.rule.id)).toEqual(['r1', 'r2', 'f1', 'h1']);
    });

    it('finds the redirect rule and its display name', () => {
        const match = attributeRedirect(rules, 'https://example.com/app/main.js', 'http://localhost:8782/app/main.js');
        expect(match.type).toBe('redirect');
        expect(match.entry.rule.id).toBe('r1');
        expect(match.entry.name).toBe('Frontend');
    });

    it('respects domain filters and ignores redirects no rule explains', () => {
        expect(attributeRedirect(rules, 'https://stage.example.com/api/x', 'http://localhost:3000/api/x').entry.name).toBe('localhost');
        expect(attributeRedirect(rules, 'https://prod.example.com/api/x', 'http://localhost:3000/api/x')).toBeNull();
        expect(attributeRedirect(rules, 'http://example.com/', 'https://example.com/')).toBeNull();
        expect(attributeRedirect(rules, 'https://example.com/off/a', 'http://localhost/off/a')).toBeNull();
    });

    it('treats data: redirects as file overrides', () => {
        const match = attributeRedirect(rules, 'https://example.com/static/main.css', 'data:text/css;charset=UTF-8;base64,Ym9keXt9');
        expect(match.type).toBe('file');
        expect(match.entry.rule.id).toBe('f1');
    });

    it('lists the header rules for a request and what they change', () => {
        expect(matchHeaderRules(rules, 'https://example.com/api/users').map(e => e.rule.id)).toEqual(['h1']);
        expect(matchHeaderRules(rules, 'https://example.com/app/x')).toEqual([]);
        expect(describeHeaderChanges(rules[3].rule)).toEqual({ request: ['set X-Debug: 1'], response: ['remove Set-Cookie'] });
    });

    it('buckets statuses', () => {
        expect(statusBucket({ status: 200 })).toBe('ok');
        expect(statusBucket({ status: 404 })).toBe('error');
        expect(statusBucket({ error: 'net::ERR_CONNECTION_REFUSED' })).toBe('error');
        expect(statusBucket({ status: null })).toBe('pending');
        expect(statusBucket({ type: 'inject' })).toBe('ok');
        expect(statusBucket({ type: 'file', inline: true })).toBe('ok');
    });
});
