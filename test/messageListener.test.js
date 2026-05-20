import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('messageListener', () => {
    let mockListener;

    beforeEach(async () => {
        // Reset modules to isolate tests
        vi.resetModules();

        // Mock global bgapp
        globalThis.bgapp = {
            ruleDomains: {},
            util: {
                simpleError: vi.fn()
            },
            mainStorage: {
                put: vi.fn().mockResolvedValue(),
                getAll: vi.fn().mockResolvedValue([]),
                delete: vi.fn().mockResolvedValue()
            },
            updateDNRRules: vi.fn(),
            setSetting: vi.fn(),
            getSetting: vi.fn(),
            extractMimeType: vi.fn()
        };

        // Mock global match function
        globalThis.match = vi.fn();

        // Mock chrome API
        globalThis.chrome = {
            runtime: {
                onMessage: {
                    addListener: vi.fn((listener) => {
                        mockListener = listener;
                    })
                },
                sendMessage: vi.fn().mockResolvedValue()
            }
        };

        // Import the script to execute the IIFE and register the listener
        await import('../src/extension/messageListener.js');
    });

    it('should broadcast "dataUpdated" and update DNR rules when a domain is saved', async () => {
        const sendResponseMock = vi.fn();
        const request = {
            action: 'saveDomain',
            data: { id: 'd1', on: true, rules: [] }
        };

        // Simulate the incoming message
        const response = mockListener(request, {}, sendResponseMock);

        // Await any microtasks (like the Promise chain in saveDomain)
        await new Promise(process.nextTick);

        // Verify storage was updated
        expect(globalThis.bgapp.mainStorage.put).toHaveBeenCalledWith(request.data);
        
        // Verify DNR rules were updated
        expect(globalThis.bgapp.updateDNRRules).toHaveBeenCalled();

        // Verify the broadcast was sent
        expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'dataUpdated' });
        
        // Verify sendResponse was called (synchronously in saveDomain)
        expect(sendResponseMock).toHaveBeenCalled();
        expect(response).toBeUndefined(); // Sync response
    });

    it('should broadcast "dataUpdated" and update DNR rules when a domain is deleted', async () => {
        const sendResponseMock = vi.fn();
        const request = {
            action: 'deleteDomain',
            id: 'd1'
        };

        mockListener(request, {}, sendResponseMock);
        await new Promise(process.nextTick);

        expect(globalThis.bgapp.mainStorage.delete).toHaveBeenCalledWith('d1');
        expect(globalThis.bgapp.updateDNRRules).toHaveBeenCalled();
        expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'dataUpdated' });
        expect(sendResponseMock).toHaveBeenCalled();
    });

    it('should broadcast "dataUpdated" and update DNR rules when importing domains', async () => {
        const sendResponseMock = vi.fn();
        const request = {
            action: 'import',
            data: [{ on: true, rules: [] }]
        };

        mockListener(request, {}, sendResponseMock);
        await new Promise(process.nextTick);

        expect(globalThis.bgapp.mainStorage.put).toHaveBeenCalled();
        expect(globalThis.bgapp.updateDNRRules).toHaveBeenCalled();
        expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'dataUpdated' });
        expect(sendResponseMock).toHaveBeenCalled();
    });
});
