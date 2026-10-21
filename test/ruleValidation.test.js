import { describe, it, expect } from 'vitest';
import { validateRule } from '../src/lib/ruleValidation.js';

const messages = (rule) => validateRule(rule).map(issue => `${issue.level}: ${issue.message}`);
const redirect = (fields) => ({ type: 'normalOverride', ...fields });

describe('rule validation', () => {
    it('says nothing about a new, empty rule or a correct one', () => {
        expect(messages(redirect({ match: '', replace: '' }))).toEqual([]);
        expect(messages(redirect({ match: '*/app/**', replace: 'http://localhost:3000/app/**' }))).toEqual([]);
        expect(messages(redirect({ matchMode: 'regex', match: 'example\\.com\\/(.*)', replace: 'http://localhost/$1' }))).toEqual([]);
    });

    it('asks for the missing half of a redirect', () => {
        expect(messages(redirect({ match: '*/app/**', replace: '' }))).toEqual(['warning: Add a destination; until then the rule does nothing.']);
        expect(messages(redirect({ match: '', replace: 'http://localhost/' }))[0]).toMatch(/^warning: Add a source pattern/);
    });

    it('rejects destinations Chrome cannot redirect to', () => {
        expect(messages(redirect({ match: '*', replace: 'localhost:3000/app' }))[0]).toMatch(/^error: The destination has to be a full URL/);
        expect(messages(redirect({ match: '*', replace: 'http://local host:3000/' }))).toEqual(["error: The destination isn't a valid URL."]);
        expect(messages(redirect({ match: '*/app/**', replace: '/relative/**' }))).toEqual([]);
    });

    it('catches regex group references the pattern does not have', () => {
        expect(messages(redirect({ matchMode: 'regex', match: '(a)(b)', replace: 'http://x/$3' })))
            .toEqual(['error: The destination uses $3, but the pattern has only 2 groups.']);
        expect(messages(redirect({ matchMode: 'regex', match: 'abc', replace: 'http://x/$1' })))
            .toEqual(['error: The destination uses $1, but the pattern has no groups.']);
    });

    it('catches regex syntax Chrome does not support or that is invalid', () => {
        expect(messages(redirect({ matchMode: 'regex', match: 'a(?=b)', replace: 'http://x/' }))[0]).toMatch(/lookahead/);
        expect(messages(redirect({ matchMode: 'regex', match: '(a)\\1', replace: 'http://x/' }))[0]).toMatch(/backreferences/);
        expect(messages(redirect({ matchMode: 'regex', match: '(a', replace: 'http://x/' }))[0]).toMatch(/^error: The pattern isn't a valid regular expression/);
    });

    it('warns when destination stars have nothing to take from', () => {
        expect(messages(redirect({ match: '*/app/*', replace: 'http://x/**' })))
            .toEqual(['warning: ** in the destination has no ** left in the pattern to take text from, so it stays as literal **.']);
        expect(messages(redirect({ match: '*/app/**', replace: 'http://x/*/**/*' }))[0]).toMatch(/^warning: \* in the destination/);
    });

    it('checks header names, values and domain filters', () => {
        expect(messages({ type: 'headerRule', match: '*', requestRules: [{ operation: 'set', header: 'My Header', value: '1' }] }))
            .toEqual([`error: "My Header" isn't a valid header name (letters, digits and dashes; no spaces).`]);
        expect(messages({ type: 'headerRule', match: '*', requestRules: [{ operation: 'set', header: 'X-A', value: 'a\nb' }] }))
            .toEqual(["error: The value of X-A can't contain line breaks."]);
        expect(messages({ ...redirect({ match: '*', replace: 'http://x/' }), domainFiltersOn: true, includeDomains: 'example.com, stage-*.foo.com' }))
            .toEqual([`error: "stage-*.foo.com" isn't a domain. Use e.g. example.com; subdomains are included.`]);
    });
});
