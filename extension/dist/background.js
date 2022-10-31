const tabsData = {};
const savedUrlsTabData = {};
chrome.storage.local.get("savedURLS", (value) => {
    if (value["savedURLS"] == undefined) {
        chrome.storage.local.set({
            savedURLS: ["https://soap2day.day/"],
        });
    }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    function turnOn(tabId) {
        chrome.storage.local.set({
            ["applicationIsOn" + tabId]: true,
        });
        tabsData[tabId] = {
            tabId,
            active: true,
        };
        savedUrlsTabData[tabId] = {
            tabId,
            lastURL: changeInfo.url,
        };
        startRedirectStopper(tabId);
    }
    if (!changeInfo.url)
        return;
    chrome.storage.local.get("savedURLS", (value) => {
        if (value["savedURLS"]?.some((url) => tab.url?.includes(url))) {
            try {
                if (changeInfo.url.includes(new URL(savedUrlsTabData[tabId].lastURL).origin)) {
                    return (savedUrlsTabData[tabId] = {
                        tabId,
                        lastURL: changeInfo.url,
                    });
                }
                turnOn(tabId);
            }
            catch (e) {
                turnOn(tabId);
            }
        }
    });
});
chrome.tabs.onRemoved.addListener((tabId) => {
    delete savedUrlsTabData[tabId];
    stopRedirectStopper(tabId);
});
chrome.runtime.onMessage.addListener((value) => {
    if (value.isOn) {
        tabsData[value.tabId] = {
            tabId: value.tabId,
            active: true,
        };
        startRedirectStopper(value.tabId);
    }
    else
        stopRedirectStopper(value.tabId);
});
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-application") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            chrome.storage.local.get(["applicationIsOn" + tab.id], (result) => {
                let value = result["applicationIsOn" + tab.id];
                if (!value) {
                    chrome.storage.local.set({
                        ["applicationIsOn" + tabs[0].id]: true,
                    });
                    tabsData[tab.id] = {
                        tabId: tab.id,
                        active: true,
                    };
                    startRedirectStopper(tab.id);
                }
                else {
                    stopRedirectStopper(tab.id);
                }
            });
        });
    }
});
function startRedirectStopper(tabId) {
    if (!tabsData[tabId])
        return;
    const tabData = tabsData[tabId];
    chrome.tabs.onCreated.addListener(async function (tab) {
        if (!tabsData[tabId])
            return chrome.tabs.onCreated.removeListener(this);
        tabData.latestCreatedTab = tab.id;
    });
    chrome.tabs.onActivated.addListener(async function (tab) {
        if (!tabsData[tabId])
            return chrome.tabs.onCreated.removeListener(this);
        if (tab.tabId === tabData.latestCreatedTab && tabData.active) {
            await chrome.tabs.update(tabId, { active: true }).catch((e) => e);
            await chrome.tabs.remove(tab.tabId).catch((e) => e);
        }
        else if (tab.tabId === tabId) {
            tabData.active = true;
        }
        else {
            tabData.active = false;
        }
    });
    chrome.tabs.onRemoved.addListener((tabId) => stopRedirectStopper(tabId));
}
function stopRedirectStopper(tabId) {
    chrome.storage.local.remove(["applicationIsOn" + tabId]).catch((e) => e);
    delete tabsData[tabId];
}
