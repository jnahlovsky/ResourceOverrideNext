import { describe, it, expect } from 'vitest';
import { selectMocks } from '../src/lib/mocks.js';
import { getSiteLists } from '../src/extension/urlPattern.js';

const domains = [{ id: 'd1', on: true, matchUrl: '*', rules: [
    { id: 'm1', type: 'mockRule', on: true, match: '*/api/users', mockMode: 'mock', status: '404', contentType: 'application/json', body: '{"error":1}', mockHeaders: [{ header: 'X-Mock', value: 'yes' }, { header: '', value: 'x' }], delay: '250' },
    { id: 'm2', type: 'mockRule', on: true, matchMode: 'regex', match: 'example\\.com\\/slow', mockMode: 'delay', delay: 999999, domainFiltersOn: true, includeDomains: 'example.com' },
    { id: 'off', type: 'mockRule', on: false, match: '*/x' },
    { id: 'empty', type: 'mockRule', on: true, match: '' },
    { id: 'r', type: 'normalOverride', on: true, match: '*', replace: 'http://x/' }
] }];

describe('mock selection', () => {
    it('passes switched-on mocks with their regex, filters and normalized values', () => {
        const mocks = selectMocks(domains, 'https://app.example.com/page', getSiteLists({}));
        expect(mocks.map(m => m.id)).toEqual(['m1', 'm2']);
        expect(mocks[0]).toMatchObject({ mode: 'mock', status: 404, delay: 250, headers: [{ header: 'X-Mock', value: 'yes' }] });
        expect(new RegExp(mocks[0].regex, 'i').test('https://app.example.com/api/users')).toBe(true);
        expect(mocks[1]).toMatchObject({ mode: 'delay', delay: 60000, include: ['example.com'], regex: 'example\\.com\\/slow' });
    });

    it('follows the site lists', () => {
        expect(selectMocks(domains, 'https://app.example.com/', getSiteLists({ siteBlocklist: 'example.com' }))).toEqual([]);
    });
});
