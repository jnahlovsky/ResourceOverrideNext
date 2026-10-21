import { describe, it, expect } from 'vitest';
import { parseSiteList, siteMatchesHost, siteIsEnabled, getSiteLists, buildSiteBlockConditions, buildSiteVariants } from '../src/extension/urlPattern.js';

const ALL_TYPES = ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'];

describe('site lists', () => {
    it('parses domains, *. prefixes and wildcards', () => {
        expect(parseSiteList('Example.com, *.stage.example.com  https://prod-*.example.com:8443/x; localhost')).toEqual([
            { pattern: 'example.com', domain: 'example.com' },
            { pattern: '*.stage.example.com', domain: 'stage.example.com' },
            { pattern: 'prod-*.example.com' },
            { pattern: 'localhost', domain: 'localhost' }
        ]);
        expect(parseSiteList('')).toEqual([]);
    });

    it('matches hosts like Chrome domain lists, and wildcards anywhere', () => {
        const [domain, , wildcard] = parseSiteList('example.com, x, prod-*.example.com');
        expect(siteMatchesHost(domain, 'example.com')).toBe(true);
        expect(siteMatchesHost(domain, 'a.b.example.com')).toBe(true);
        expect(siteMatchesHost(domain, 'notexample.com')).toBe(false);
        expect(siteMatchesHost(wildcard, 'prod-eu.example.com')).toBe(true);
        expect(siteMatchesHost(wildcard, 'stage.example.com')).toBe(false);
    });

    it('lets the blocklist win and ignores allowlist entries Chrome cannot apply', () => {
        const sites = getSiteLists({ siteAllowlist: 'example.com, stage-*.foo.com', siteBlocklist: 'prod-*.example.com' });
        expect(sites.allow.map(s => s.pattern)).toEqual(['example.com']);
        expect(siteIsEnabled(sites, 'stage.example.com')).toBe(true);
        expect(siteIsEnabled(sites, 'prod-eu.example.com')).toBe(false);
        expect(siteIsEnabled(sites, 'other.com')).toBe(false);
        expect(siteIsEnabled(getSiteLists({}), 'anything.com')).toBe(true);
    });

    it('builds page rules for the blocklist that match the page host only', () => {
        const [condition] = buildSiteBlockConditions(getSiteLists({ siteBlocklist: 'prod-*.example.com' }));
        const regex = new RegExp(condition.regexFilter);
        expect(condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
        expect(regex.test('https://prod-eu.example.com/app')).toBe(true);
        expect(regex.test('https://prod-eu.example.com:8443')).toBe(true);
        expect(regex.test('https://stage.example.com/?next=prod-eu.example.com/')).toBe(false);
    });

    it('splits a rule into page loads and requests made by pages', () => {
        const condition = { regexFilter: 'x', resourceTypes: ALL_TYPES };
        expect(buildSiteVariants(condition, getSiteLists({}))).toEqual([condition]);
        expect(buildSiteVariants(condition, getSiteLists({ siteAllowlist: 'example.com', siteBlocklist: 'cdn.example.com, prod-*.x.com' }))).toEqual([
            { regexFilter: 'x', resourceTypes: ['main_frame'], requestDomains: ['example.com'] },
            { regexFilter: 'x', resourceTypes: ['sub_frame', 'script', 'xmlhttprequest'], initiatorDomains: ['example.com'], excludedInitiatorDomains: ['cdn.example.com'] }
        ]);
    });

    it('keeps a rule\'s own domain filter inside the allowlist', () => {
        const allow = getSiteLists({ siteAllowlist: 'example.com' });
        expect(buildSiteVariants({ requestDomains: ['a.example.com', 'other.com'], resourceTypes: ['main_frame'] }, allow))
            .toEqual([{ requestDomains: ['a.example.com'], resourceTypes: ['main_frame'] }]);
        expect(buildSiteVariants({ requestDomains: ['other.com'], resourceTypes: ['main_frame'] }, allow)).toEqual([]);
    });
});
