import { describe, it, expect } from 'vitest';
import { RULE_TEMPLATES, ruleFromTemplate } from '../src/lib/templates.js';
import { RULE_GROUPS } from '../src/lib/ruleLabels.js';
import { buildUrlMatch } from '../src/extension/urlPattern.js';
import { validateRule } from '../src/lib/ruleValidation.js';

describe('rule templates', () => {
    it('each makes a complete, valid rule of a type in its tab', () => {
        RULE_TEMPLATES.forEach(template => {
            const group = RULE_GROUPS.find(g => g.value === template.group);
            const variants = template.variants ? template.variants.map(v => v.id) : [''];
            variants.forEach(variant => {
                const rule = ruleFromTemplate(template, 'stage.example.com', variant);
                expect(group.types, template.id).toContain(rule.type);
                expect(rule.on).toBe(true);
                if (rule.type !== 'fileInject') expect(buildUrlMatch(rule), template.id).not.toBeNull();
                expect(validateRule(rule).filter(issue => issue.level === 'error'), template.id).toEqual([]);
            });
        });
    });

    it('uses the current site where it has one', () => {
        const csp = RULE_TEMPLATES.find(t => t.id === 'remove-csp');
        expect(ruleFromTemplate(csp, 'shop.example.com').match).toBe('||shop.example.com^');
        expect(ruleFromTemplate(csp, '').match).toBe('||example.com^');
    });
});
