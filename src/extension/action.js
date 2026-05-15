{
    chrome.action.onClicked.addListener(() => {
        const optionsUrl = chrome.runtime.getURL("index.html");
        
        chrome.tabs.query({}, function(extensionTabs) {
            let found = false;
            for (let i = 0, len = extensionTabs.length; i < len; i++) {
                if (extensionTabs[i].url && extensionTabs[i].url.split('#')[0].split('?')[0] === optionsUrl) {
                    found = true;
                    chrome.tabs.update(extensionTabs[i].id, {active: true});
                    chrome.windows.update(extensionTabs[i].windowId, {focused: true});
                    break;
                }
            }
            if (!found) {
                chrome.tabs.create({url: optionsUrl});
            }
        });
    });
}
