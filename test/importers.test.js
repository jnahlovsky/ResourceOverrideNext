import { describe, it, expect } from 'vitest';
import { importRulesFrom } from '../src/lib/importers.js';
import { buildUrlMatch, evaluateUrlMatch } from '../src/extension/urlPattern.js';

const redirectOf = (rule, url) => evaluateUrlMatch(buildUrlMatch(rule), url).redirectUrl;

describe('importing Resource Override', () => {
    const export_ = [
        { id: 'd1', matchUrl: '*', on: true, rules: [
            { type: 'normalOverride', match: '*/app/**', replace: 'http://localhost:3000/app/**', on: true },
            { type: 'headerRule', match: '*', on: true, requestRules: 'set X-Debug: 1;remove Cookie', responseRules: 'set Access-Control-Allow-Origin: %2A' }
        ] },
        { id: 'd2', matchUrl: '*://*.stage.example.com/*', on: false, rules: [{ type: 'fileInject', fileName: 'a.js', fileType: 'js', file: 'x()', on: true }] }
    ];

    it('parses header strings, carries domains over and gives new ids', () => {
        const result = importRulesFrom(export_);
        expect(result.source).toBe('Resource Override');
        expect(result.rules).toHaveLength(3);
        expect(result.rules[1].requestRules).toEqual([{ operation: 'set', header: 'X-Debug', value: '1' }, { operation: 'remove', header: 'Cookie', value: '' }]);
        expect(result.rules[1].responseRules).toEqual([{ operation: 'set', header: 'Access-Control-Allow-Origin', value: '*' }]);
        expect(result.rules[2]).toMatchObject({ on: false, domainFiltersOn: true, includeDomains: 'stage.example.com' });
        expect(new Set(result.rules.map(r => r.id)).size).toBe(3);
    });
});

describe('importing Requestly', () => {
    const export_ = [
        { objectType: 'group', name: 'Group' },
        { ruleType: 'Redirect', name: 'Local app', status: 'Active', pairs: [{ source: { key: 'Url', operator: 'Wildcard_Matches', value: 'https://example.com/app/*' }, destination: 'http://localhost:3000/app/$1' }] },
        { ruleType: 'Cancel', name: 'No ads', status: 'Inactive', pairs: [{ source: { key: 'Url', operator: 'Contains', value: 'doubleclick.net' } }] },
        { ruleType: 'QueryParam', name: 'Debug', status: 'Active', pairs: [{ source: { key: 'host', operator: 'Equals', value: 'example.com' }, modifications: [{ type: 'Add', param: 'debug', value: '1' }, { type: 'Remove', param: 'utm' }] }] },
        { ruleType: 'Headers', name: 'Headers', status: 'Active', pairs: [{ source: { key: 'Url', operator: 'Contains', value: '/api' }, modifications: { Request: [{ type: 'Add', header: 'X-A', value: '1' }], Response: [{ type: 'Remove', header: 'Set-Cookie' }] } }] },
        { ruleType: 'UserAgent', name: 'iPhone', status: 'Active', pairs: [{ source: { key: 'Url', operator: 'Contains', value: 'example.com' }, userAgent: 'iPhone UA' }] },
        { ruleType: 'Script', name: 'Scripts', status: 'Active', pairs: [{ source: { key: 'host', operator: 'Contains', value: 'example.com' }, scripts: [{ type: 'code', codeType: 'js', value: 'x()', loadTime: 'afterPageLoad' }, { type: 'url', codeType: 'js', value: 'https://cdn/x.js' }] }] },
        { ruleType: 'Response', name: 'Mock', status: 'Active', pairs: [{ source: { key: 'Url', operator: 'Matches', value: '/api\\/users/i' }, response: { type: 'static', value: '{"a":1}', statusCode: '201' } }] },
        { ruleType: 'Replace', name: 'Replace', status: 'Active', pairs: [{ source: { key: 'Url', operator: 'Contains', value: 'x' } }] }
    ];

    it('converts each rule type and lists what it skips', () => {
        const result = importRulesFrom(export_);
        expect(result.source).toBe('Requestly');
        expect(result.rules.map(r => r.type)).toEqual(['normalOverride', 'blockRule', 'queryRule', 'headerRule', 'headerRule', 'fileInject', 'mockRule']);
        expect(redirectOf(result.rules[0], 'https://example.com/app/js/main.js')).toBe('http://localhost:3000/app/js/main.js');
        expect(result.rules[1].on).toBe(false);
        expect(result.rules[2]).toMatchObject({ match: '||example.com^', params: [{ operation: 'set', key: 'debug', value: '1' }, { operation: 'remove', key: 'utm' }] });
        expect(result.rules[3].responseRules).toEqual([{ operation: 'remove', header: 'Set-Cookie', value: '' }]);
        expect(result.rules[4].requestRules[0]).toEqual({ operation: 'set', header: 'User-Agent', value: 'iPhone UA' });
        expect(result.rules[5]).toMatchObject({ fileType: 'js', injectTiming: 'loaded', includeDomains: 'example.com' });
        expect(result.rules[6]).toMatchObject({ matchMode: 'regex', match: 'api\\/users', status: 201, contentType: 'application/json' });
        expect(result.skipped.map(s => s.name)).toEqual(['Scripts', 'Replace']);
    });
});

describe('importing Redirector', () => {
    it('covers the whole URL so Chrome replaces all of it', () => {
        const result = importRulesFrom({ createdBy: 'Redirector v3.5.3', redirects: [
            { description: 'Wildcard', includePattern: 'https://example.com/*/js/*', redirectUrl: 'http://localhost:3000/$1/$2', patternType: 'W', disabled: false },
            { description: 'Regex', includePattern: 'cdn\\.example\\.com/(.*)', redirectUrl: 'http://localhost:9000/$1', patternType: 'R', disabled: true, excludePattern: 'nope' }
        ] });
        expect(result.source).toBe('Redirector');
        expect(redirectOf(result.rules[0], 'https://example.com/v2/js/app.js')).toBe('http://localhost:3000/v2/app.js');
        expect(redirectOf(result.rules[1], 'https://cdn.example.com/lib/x.js?v=1')).toBe('http://localhost:9000/lib/x.js?v=1');
        expect(result.rules[1].on).toBe(false);
        expect(result.notes[0]).toMatch(/exclude pattern/);
    });

    it('rejects files it does not know', () => {
        expect(() => importRulesFrom({ hello: 1 })).toThrow(/isn't a rules export/);
    });
});
