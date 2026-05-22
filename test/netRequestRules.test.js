import { describe, it, expect } from 'vitest';
// We just want to mock the logic directly to see what objects are being passed to Chrome

describe('DNR Header Logic', () => {
    it('creates valid modifyHeaders payloads', () => {
        const ruleObj = {
            type: "headerRule",
            match: "*",
            requestRules: [{ header: "req-header", operation: "set", value: "1" }],
            responseRules: [{ header: "res-header", operation: "set", value: "2" }]
        };

        let action = {
            type: "modifyHeaders",
            requestHeaders: [],
            responseHeaders: []
        };

        if (ruleObj.requestRules && ruleObj.requestRules.length > 0) {
            ruleObj.requestRules.forEach(req => {
                if (!req.header) return;
                const headerMod = { header: req.header, operation: req.operation };
                if (req.operation !== "remove") {
                    headerMod.value = req.value || "";
                }
                action.requestHeaders.push(headerMod);
            });
        }

        if (ruleObj.responseRules && ruleObj.responseRules.length > 0) {
            ruleObj.responseRules.forEach(res => {
                if (!res.header) return;
                const headerMod = { header: res.header, operation: res.operation };
                if (res.operation !== "remove") {
                    headerMod.value = res.value || "";
                }
                action.responseHeaders.push(headerMod);
            });
        }

        if (action.requestHeaders.length === 0) delete action.requestHeaders;
        if (action.responseHeaders.length === 0) delete action.responseHeaders;

        expect(action.responseHeaders[0].operation).toBe("set");
    });
});
