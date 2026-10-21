import { describe, it, expect } from 'vitest';
import {
    wildcardToRegexSubstitution,
    applyRegexSubstitution,
    parseDomainList,
    hostPassesDomainFilters,
    applyDomainFilters,
    getMatchMode,
    convertMatchMode,
    buildUrlMatch,
    evaluateUrlMatch,
    getTargetPort,
    getTargetHost,
    setTargetPort,
    parsePortInput
} from '../src/extension/urlPattern.js';

const redirect = (match, replace, url) => {
    const sub = wildcardToRegexSubstitution(match, replace);
    return applyRegexSubstitution(sub.regexFilter, sub.regexSubstitution, url);
};

describe('wildcardToRegexSubstitution', () => {
    it('carries the ** match into the destination', () => {
        const match = '*/betslip-history-detail/**';
        const replace = 'https://localhost:8082/fe/betslip-history-detail/**';

        expect(wildcardToRegexSubstitution(match, replace)).toEqual({
            regexFilter: '^(.*?)\\/betslip-history-detail\\/(.*)',
            regexSubstitution: 'https://localhost:8082/fe/betslip-history-detail/\\2'
        });
        expect(redirect(match, replace, 'https://stage.example.com/fe/betslip-history-detail/main.js?v=3'))
            .toBe('https://localhost:8082/fe/betslip-history-detail/main.js?v=3');
        expect(redirect(match, replace, 'https://stage.example.com/fe/betslip-history-detail/chunks/a/b.js'))
            .toBe('https://localhost:8082/fe/betslip-history-detail/chunks/a/b.js');
        expect(redirect(match, replace, 'https://stage.example.com/fe/other/main.js')).toBeNull();
    });

    it('pairs star groups by length, in order', () => {
        expect(redirect('a*b**c***d', 'e***f*g**h****', 'a1b2c3d')).toBe('e3f1g2h****');
        expect(redirect('*://cdn.example.com/*', 'http://localhost/*/*', 'https://cdn.example.com/x.js'))
            .toBe('http://localhost/https/x.js');
    });

    // Chrome replaces only the matched part of the URL; the result has to be the destination alone.
    it('replaces the whole URL when the pattern starts mid-URL', () => {
        expect(redirect('127.0.0.1:8781/app/**', 'http://localhost:8782/app/**', 'http://127.0.0.1:8781/app/js/main.js'))
            .toBe('http://localhost:8782/app/js/main.js');
        expect(redirect('example.com/**', 'http://localhost:3000/**', 'https://www.example.com/a.js?v=1'))
            .toBe('http://localhost:3000/a.js?v=1');
    });

    it('keeps the rest of the URL after a pattern that ends mid-URL', () => {
        expect(redirect('*/app/**.js', 'http://localhost:3000/app/**.js', 'https://example.com/app/main.js?v=1'))
            .toBe('http://localhost:3000/app/main.js?v=1');
    });

    it('keeps urlFilter anchors and separators', () => {
        const sub = wildcardToRegexSubstitution('||example.com^*', 'http://localhost/*');
        expect(applyRegexSubstitution(sub.regexFilter, sub.regexSubstitution, 'https://www.example.com/app.js'))
            .toBe('http://localhost/app.js');
        expect(applyRegexSubstitution(sub.regexFilter, sub.regexSubstitution, 'https://notexample.com/app.js'))
            .toBeNull();
    });

    it('returns null when there is nothing to substitute', () => {
        expect(wildcardToRegexSubstitution('*/main.js', 'http://localhost/main.js')).toBeNull();
        expect(wildcardToRegexSubstitution('example.com/main.js', 'http://localhost/*')).toBeNull();
        expect(wildcardToRegexSubstitution('*a*b*c*d*e*f*g*h*i*j', 'http://localhost/*')).toBeNull();
    });

    it('escapes regex characters and backslashes', () => {
        const sub = wildcardToRegexSubstitution('https://a.com/(x)?/*', 'http://b\\c/*');
        expect(sub.regexFilter).toBe('^.*?https:\\/\\/a\\.com\\/\\(x\\)\\?\\/(.*)');
        expect(sub.regexSubstitution).toBe('http://b\\\\c/\\1');
    });
});

describe('domain filters', () => {
    it('normalizes user input into bare host names', () => {
        expect(parseDomainList('localhost, *.Example.com  https://cdn.foo.io:8080/x;stage.example.com.'))
            .toEqual(['localhost', 'example.com', 'cdn.foo.io', 'stage.example.com']);
        expect(parseDomainList('')).toEqual([]);
        expect(parseDomainList(undefined)).toEqual([]);
    });

    it('is ignored while switched off', () => {
        const rule = { domainFiltersOn: false, excludeDomains: 'localhost' };
        expect(hostPassesDomainFilters(rule, 'localhost')).toBe(true);
        expect(applyDomainFilters({}, rule)).toEqual({});
    });

    it('matches subdomains like Chrome requestDomains', () => {
        const rule = { domainFiltersOn: true, includeDomains: 'example.com', excludeDomains: 'cdn.example.com' };
        expect(hostPassesDomainFilters(rule, 'stage.example.com')).toBe(true);
        expect(hostPassesDomainFilters(rule, 'img.cdn.example.com')).toBe(false);
        expect(hostPassesDomainFilters(rule, 'notexample.com')).toBe(false);
        expect(applyDomainFilters({}, rule)).toEqual({
            requestDomains: ['example.com'],
            excludedRequestDomains: ['cdn.example.com']
        });
    });
});

describe('match mode', () => {
    it('infers regex from legacy /slashes/', () => {
        expect(getMatchMode({ match: '/a(.*)/' })).toBe('regex');
        expect(getMatchMode({ match: '*/a/**' })).toBe('wildcard');
        expect(getMatchMode({ match: '/a(.*)/', matchMode: 'wildcard' })).toBe('wildcard');
    });

    it('converts wildcard rules to regex and back', () => {
        const rule = {
            type: 'normalOverride',
            match: '*/betslip-history-detail/**',
            replace: 'https://localhost:8082/fe/betslip-history-detail/**'
        };
        const asRegex = convertMatchMode(rule, 'regex');
        expect(asRegex).toEqual({
            matchMode: 'regex',
            match: '(.*?)\\/betslip-history-detail\\/(.*)',
            replace: 'https://localhost:8082/fe/betslip-history-detail/$2'
        });
        expect(convertMatchMode({ ...rule, ...asRegex }, 'wildcard')).toEqual({ matchMode: 'wildcard', match: rule.match, replace: rule.replace });
    });

    it('keeps regexes that wildcards cannot express', () => {
        const rule = { type: 'normalOverride', match: '/https:\\/\\/(\\w+)\\.com/', replace: 'http://x/$1' };
        expect(convertMatchMode(rule, 'wildcard')).toEqual({ matchMode: 'wildcard' });
    });

    it('builds the same redirect in both modes', () => {
        const url = 'https://stage.example.com/fe/betslip-history-detail/chunks/main.js?v=2';
        const expected = 'https://localhost:8082/fe/betslip-history-detail/chunks/main.js?v=2';
        const wildcard = { type: 'normalOverride', match: '*/betslip-history-detail/**', replace: 'https://localhost:8082/fe/betslip-history-detail/**' };
        const regex = { ...wildcard, ...convertMatchMode(wildcard, 'regex') };

        expect(buildUrlMatch(regex).redirect.regexSubstitution).toBe('https://localhost:8082/fe/betslip-history-detail/\\2');
        expect(evaluateUrlMatch(buildUrlMatch(wildcard), url)).toEqual({ matched: true, redirectUrl: expected });
        expect(evaluateUrlMatch(buildUrlMatch(regex), url)).toEqual({ matched: true, redirectUrl: expected });
    });

    it('uses urlFilter for static redirects and other rule types', () => {
        expect(buildUrlMatch({ type: 'normalOverride', match: 'example.com/a.js', replace: 'http://localhost/a.js' }))
            .toEqual({ condition: { urlFilter: 'example.com/a.js' }, redirect: { url: 'http://localhost/a.js' } });
        expect(buildUrlMatch({ type: 'headerRule', match: '*' })).toEqual({ condition: {} });
        expect(buildUrlMatch({ type: 'headerRule', match: '/api\\/.*/' })).toEqual({ condition: { regexFilter: 'api\\/.*' } });
        expect(evaluateUrlMatch(buildUrlMatch({ type: 'headerRule', match: 'example.com/api/*' }), 'https://www.EXAMPLE.com/api/v1'))
            .toEqual({ matched: true });
    });

    it('skips incomplete rules', () => {
        expect(buildUrlMatch({ type: 'normalOverride', match: '', replace: 'http://x/' })).toBeNull();
        expect(buildUrlMatch({ type: 'normalOverride', match: 'a', replace: 'not-a-url' })).toBeNull();
        expect(buildUrlMatch({ type: 'normalOverride', matchMode: 'regex', match: '(.*)', replace: '' })).toBeNull();
        expect(buildUrlMatch({ type: 'fileOverride', match: '' })).toBeNull();
    });
});

describe('redirect target', () => {
    it('reads the explicit port and host', () => {
        expect(getTargetPort('https://localhost:8082/fe/**')).toBe('8082');
        expect(getTargetPort('http://[::1]:3000/')).toBe('3000');
        expect(getTargetPort('http://user:pw@host:8443')).toBe('8443');
        expect(getTargetPort('https://example.com/a:1')).toBe('');
        expect(getTargetPort('')).toBe('');
        expect(getTargetHost('https://localhost:8082/fe/**')).toBe('localhost');
    });

    it('rewrites, adds and removes the port', () => {
        expect(setTargetPort('https://localhost:8082/fe/**', '9000')).toBe('https://localhost:9000/fe/**');
        expect(setTargetPort('https://localhost/fe/$1', '3000')).toBe('https://localhost:3000/fe/$1');
        expect(setTargetPort('http://localhost:3000', '')).toBe('http://localhost');
        expect(setTargetPort('http://[::1]:3000/x', '4000')).toBe('http://[::1]:4000/x');
        expect(setTargetPort('/relative/path', '3000')).toBe('/relative/path');
        expect(setTargetPort('', '3000')).toBe('');
    });

    it('parses a typed port', () => {
        expect(parsePortInput(' 3000 ')).toBe('3000');
        expect(parsePortInput(':8082')).toBe('8082');
        expect(parsePortInput('')).toBe('');
        expect(parsePortInput('0')).toBeNull();
        expect(parsePortInput('65536')).toBeNull();
        expect(parsePortInput('80a')).toBeNull();
    });
});

describe('new rule types', () => {
    it('needs a pattern for block, query and mock rules', () => {
        expect(buildUrlMatch({ type: 'blockRule', match: '' })).toBeNull();
        expect(buildUrlMatch({ type: 'mockRule', match: '' })).toBeNull();
        expect(buildUrlMatch({ type: 'blockRule', match: '*/analytics.js' })).toEqual({ condition: { urlFilter: '*/analytics.js' } });
    });

    it('turns a query parameter rule into a query transform', () => {
        const built = buildUrlMatch({ type: 'queryRule', match: 'example.com/app', params: [
            { operation: 'set', key: 'debug', value: '1' }, { operation: 'set', key: '', value: 'x' }, { operation: 'remove', key: 'utm_source' }
        ] });
        expect(built.redirect).toEqual({ transform: { queryTransform: { addOrReplaceParams: [{ key: 'debug', value: '1' }], removeParams: ['utm_source'] } } });
        expect(evaluateUrlMatch(built, 'https://example.com/app?utm_source=x&a=2'))
            .toEqual({ matched: true, redirectUrl: 'https://example.com/app?a=2&debug=1' });
        expect(buildUrlMatch({ type: 'queryRule', match: '*', params: [] })).toBeNull();
    });
});
