/* global bgapp, chrome, match */
{
    bgapp.ruleDomains = bgapp.ruleDomains || {};
    bgapp.syncFunctions = bgapp.syncFunctions || [];

    const simpleError = bgapp.util.simpleError;

    const syncAllInstances = function() {
        bgapp.syncFunctions.forEach(function(fn) {
            try {
                fn();
            } catch (e) { /**/ }
        });
        bgapp.syncFunctions = [];
    };

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "saveDomain") {
            bgapp.mainStorage.put(request.data)
                .then(syncAllInstances)
                .catch(simpleError);
            bgapp.ruleDomains[request.data.id] = request.data;
            sendResponse();
        } else if (request.action === "getDomains") {
            bgapp.mainStorage.getAll().then(function(domains) {
                sendResponse(domains || []);
            }).catch(simpleError);
            return true; // async
        } else if (request.action === "deleteDomain") {
            bgapp.mainStorage.delete(request.id)
                .then(syncAllInstances)
                .catch(simpleError);
            delete bgapp.ruleDomains[request.id];
            sendResponse();
        } else if (request.action === "import") {
            let maxId = 0;
            for (const id in bgapp.ruleDomains) {
                maxId = Math.max(maxId, parseInt(id.substring(1)));
            }
            maxId++;
            Promise.all(request.data.map(function(domainData) {
                // dont overwrite any pre-existing domains.
                domainData.id = "d" + maxId++;
                bgapp.ruleDomains[domainData.id] = domainData;
                return bgapp.mainStorage.put(domainData);
            }))
            .then(syncAllInstances)
            .catch(simpleError);
            sendResponse();
        } else if (request.action === "makeGetRequest") {
            fetch(request.url)
                .then(res => res.text())
                .then(text => sendResponse(text))
                .catch(() => sendResponse(""));
            return true; // async
        } else if (request.action === "setSetting") {
            bgapp.setSetting(request.setting, request.value);
            sendResponse();
        } else if (request.action === "getSetting") {
            sendResponse(bgapp.getSetting(request.setting));
        } else if (request.action === "syncMe") {
            bgapp.syncFunctions.push(sendResponse);
            return true; // async
        } else if (request.action === "match") {
            sendResponse(match(request.domainUrl, request.windowUrl).matched);
        } else if (request.action === "extractMimeType") {
            sendResponse(bgapp.extractMimeType(request.fileName, request.file));
        } else if (request.action === "log") {
            // Already handled by UI content script but we keep it here just in case
            sendResponse();
        }

        // Return false/undefined for sync responses if we didn't return true
    });

    // init domain storage
    bgapp.mainStorage.getAll().then(function(domains) {
        if (domains) {
            domains.forEach(function(domainObj) {
                bgapp.ruleDomains[domainObj.id] = domainObj;
            });
        }
    }).catch(simpleError);
}
