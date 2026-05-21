import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateDNRRules } from '../src/extension/netRequestRules.js';

describe('updateDNRRules', () => {
    beforeEach(() => {
        // Mock global bgapp and mainStorage
        globalThis.bgapp = {
            mainStorage: {
                getAll: vi.fn()
            },
            getSetting: vi.fn().mockReturnValue("true")
        };

        // Mock global chrome API
        globalThis.chrome = {
            declarativeNetRequest: {
                getDynamicRules: vi.fn().mockResolvedValue([{ id: 999 }]), // Mock an existing rule
                updateDynamicRules: vi.fn().mockResolvedValue()
            }
        };

        // Suppress console outputs during tests to keep output clean
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should abort if bgapp or mainStorage is not initialized', async () => {
        globalThis.bgapp = null;
        await updateDNRRules();
        expect(globalThis.chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });

    it('should translate regex rules to DNR regexFilter and regexSubstitution', async () => {
        globalThis.bgapp.mainStorage.getAll.mockResolvedValue([
            {
                on: true,
                rules: [
                    {
                        on: true,
                        type: 'normalOverride',
                        match: '/^https:\\/\\/test\\.com\\/(.*)/',
                        replace: 'https://localhost/$1'
                    }
                ]
            }
        ]);

        await updateDNRRules();

        expect(globalThis.chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
            removeRuleIds: [999], // Should remove existing mocked rule
            addRules: [{
                id: 1,
                priority: 100,
                action: {
                    type: 'redirect',
                    redirect: {
                        // $1 should be converted to \1
                        regexSubstitution: 'https://localhost/\\1'
                    }
                },
                condition: {
                    // slashes should be stripped
                    regexFilter: '^https:\\/\\/test\\.com\\/(.*)',
                    resourceTypes: expect.any(Array)
                }
            }]
        });
    });

    it('should translate standard star syntax rules to DNR urlFilter', async () => {
        globalThis.bgapp.mainStorage.getAll.mockResolvedValue([
            {
                on: true,
                rules: [
                    {
                        on: true,
                        type: 'normalOverride',
                        match: '*://*.example.com/*',
                        replace: 'https://localhost/mock.js'
                    }
                ]
            }
        ]);

        await updateDNRRules();

        expect(globalThis.chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
            removeRuleIds: [999],
            addRules: [{
                id: 1,
                priority: 100,
                action: {
                    type: 'redirect',
                    redirect: {
                        url: 'https://localhost/mock.js'
                    }
                },
                condition: {
                    urlFilter: '*://*.example.com/*',
                    resourceTypes: expect.any(Array)
                }
            }]
        });
    });

    it('should ignore disabled domains and disabled rules', async () => {
        globalThis.bgapp.mainStorage.getAll.mockResolvedValue([
            {
                on: false, // Domain disabled
                rules: [
                    {
                        on: true,
                        type: 'normalOverride',
                        match: '/disabledDomain/',
                        replace: 'http://localhost'
                    }
                ]
            },
            {
                on: true,
                rules: [
                    {
                        on: false, // Rule disabled
                        type: 'normalOverride',
                        match: '/disabledRule/',
                        replace: 'http://localhost'
                    }
                ]
            }
        ]);

        await updateDNRRules();

        // Should update with empty addRules array since both rules are inactive
        expect(globalThis.chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
            removeRuleIds: [999],
            addRules: []
        });
    });

    it('should clear rules when isExtensionOn is false', async () => {
        globalThis.bgapp.getSetting.mockReturnValue("false");
        globalThis.bgapp.mainStorage.getAll.mockResolvedValue([
            {
                on: true,
                rules: [
                    {
                        on: true,
                        type: 'normalOverride',
                        match: 'test',
                        replace: 'test'
                    }
                ]
            }
        ]);

        await updateDNRRules();

        expect(globalThis.chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
            removeRuleIds: [999],
            addRules: []
        });
    });
});
