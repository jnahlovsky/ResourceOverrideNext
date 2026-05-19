import { describe, it, expect } from 'vitest';
import matchReplace from '../src/extension/match.js';

describe('matchReplace function', () => {
    it('supports standard star syntax replacements', () => {
        expect(matchReplace("asd", "qwe", "asd")).toBe("qwe");
        expect(matchReplace("asd", "qwe", "asd ")).toBe("asd ");
        expect(matchReplace("asd*", "qwe", "asd")).toBe("qwe");
        expect(matchReplace("*asd*", "*qwe*", "zxca2d123")).toBe("zxca2d123");
        expect(matchReplace("asd*qwe**", "123*456**", "asdfghqwerty")).toBe("123fgh456rty");
        expect(matchReplace("a*b**c***d", "e***f*g**h****", "a1b2c3d")).toBe("e3f1g2h****");
    });

    it('supports regex replacements using slashes', () => {
        const url = "https://stage.example.com/fe/betslip-container/main.js";
        const pattern = "/https:\\/\\/[^\\/]*(?:test|stage|localhost|ifortuna)[^\\/]*\\/fe\\/betslip-container\\/(.*)/";
        const replace = "https://localhost:8081/fe/betslip-container/$1";
        
        expect(matchReplace(pattern, replace, url)).toBe("https://localhost:8081/fe/betslip-container/main.js");
    });

    it('supports regex replacements with multiple groups', () => {
        const url = "http://www.google.com/search?q=test";
        const pattern = "/http(s)?:\\/\\/(?:www\\.)?([^\\/]+)\\/(.*)/";
        const replace = "https://$2.proxy.com/$3";
        
        expect(matchReplace(pattern, replace, url)).toBe("https://google.com.proxy.com/search?q=test");
    });
    
    it('returns the original string if regex pattern does not match', () => {
        const url = "https://production.example.com/fe/betslip-container/main.js";
        const pattern = "/https:\\/\\/[^\\/]*(?:test|stage|localhost|ifortuna)[^\\/]*\\/fe\\/betslip-container\\/(.*)/";
        const replace = "https://localhost:8081/fe/betslip-container/$1";
        
        expect(matchReplace(pattern, replace, url)).toBe(url);
    });
});
