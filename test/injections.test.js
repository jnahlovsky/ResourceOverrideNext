import { describe, it, expect } from 'vitest';
import { selectInjections, getInjectTiming } from '../src/lib/injections.js';
import { getSiteLists } from '../src/extension/urlPattern.js';

const inject = (fields) => ({ type: 'fileInject', on: true, file: 'x()', ...fields });
const domains = [
    { id: 'd1', on: true, matchUrl: '*', rules: [
        inject({ id: 'a' }),
        inject({ id: 'b', injectTiming: 'loaded' }),
        inject({ id: 'off', on: false }),
        inject({ id: 'empty', file: '' }),
        inject({ id: 'filtered', domainFiltersOn: true, includeDomains: 'other.com' }),
        { id: 'r', type: 'normalOverride', on: true, match: '*', replace: 'http://x/' }
    ] },
    { id: 'd2', on: false, matchUrl: '*', rules: [inject({ id: 'domain-off' })] }
];

describe('file injection selection', () => {
    it('picks switched-on injections with content that apply to the frame', () => {
        expect(selectInjections(domains, 'https://www.example.com/page', getSiteLists({})))
            .toEqual([{ id: 'a', timing: 'start' }, { id: 'b', timing: 'loaded' }]);
    });

    it('follows the site lists', () => {
        expect(selectInjections(domains, 'https://www.example.com/', getSiteLists({ siteBlocklist: 'example.com' }))).toEqual([]);
        expect(selectInjections(domains, 'https://www.example.com/', getSiteLists({ siteAllowlist: 'other.com' }))).toEqual([]);
    });

    it('defaults to page start', () => {
        expect(getInjectTiming({})).toBe('start');
        expect(getInjectTiming({ injectTiming: 'bogus' })).toBe('start');
        expect(getInjectTiming({ injectTiming: 'ready' })).toBe('ready');
    });
});
