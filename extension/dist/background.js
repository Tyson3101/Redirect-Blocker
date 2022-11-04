chrome.storage.local.get(["savedURLS", "tabExclusive"], (value) => {
    if (value["savedURLS"] == undefined) {
        chrome.storage.local.set({
            savedURLS: ["https://soap2day.day/"],
        });
    }
    if (value["tabExclusive"] == undefined) {
        chrome.storage.local.set({ tabExclusive: "tab" });
    }
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    function turnOn(tabIdtoTurnOn) {
        chrome.storage.local.set({
            ["applicationIsOn" + tabIdtoTurnOn]: true,
        });
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            await tabsData(tabIdtoTurnOn, {
                tabId: tabIdtoTurnOn,
                active: true,
                windowId: tabs[0].windowId,
                windowActive: true,
                lastURL: changeInfo.url,
            });
            await savedUrlsTabData(tabIdtoTurnOn, {
                tabId: tabIdtoTurnOn,
                lastURL: changeInfo.url,
            });
            startRedirectStopper(tabIdtoTurnOn);
        });
    }
    if (!changeInfo.url)
        return;
    if (!changeInfo.url.toLowerCase().includes("chrome://")) {
        chrome.storage.local.get(["savedURLS"], async (value) => {
            savedUrlsTabData(tabId, {
                tabId,
                lastURL: changeInfo.url,
            });
            if (value["savedURLS"]?.some((url) => changeInfo.url
                .toLowerCase()
                .replace("www.", "")
                ?.includes(url.toLowerCase().replace("www.", "")))) {
                try {
                    if (changeInfo.url.includes(new URL((await savedUrlsTabData(tabId, {}, false, false))?.lastURL).origin)) {
                        return;
                    }
                    turnOn(tabId);
                }
                catch (e) {
                    turnOn(tabId);
                }
            }
        });
    }
    const tabData = await tabsData(tabId, {}, false, false);
    if (!tabData)
        return;
    chrome.storage.local.get(["tabExclusive"], async ({ tabExclusive }) => {
        if (tabExclusive !== "tab" || tabExclusive != null) {
            if (new URL(tabData.lastURL).hostname !== new URL(changeInfo.url).hostname) {
                return stopRedirectStopper(tabId);
            }
        }
        tabsData(tabId, { lastURL: changeInfo.url });
    });
});
chrome.tabs.onRemoved.addListener((tabId) => {
    savedUrlsTabData(tabId, {}, true);
    stopRedirectStopper(tabId);
});
chrome.runtime.onMessage.addListener(async (value) => {
    if (value.isOn) {
        await tabsData(value.tabId, {
            tabId: value.tabId,
            active: true,
            windowActive: true,
            windowId: value.windowId,
            lastURL: value.lastURL,
        });
        startRedirectStopper(value.tabId);
    }
    else
        stopRedirectStopper(value.tabId);
});
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-application") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            chrome.storage.local.get(["applicationIsOn" + tab.id], async (result) => {
                let value = result["applicationIsOn" + tab.id];
                if (!value) {
                    chrome.storage.local.set({
                        ["applicationIsOn" + tabs[0].id]: true,
                    });
                    await tabsData(tab.id, {
                        tabId: tab.id,
                        active: true,
                        windowActive: true,
                        windowId: tab.windowId,
                        lastURL: tab.url,
                    });
                    startRedirectStopper(tab.id);
                }
                else {
                    stopRedirectStopper(tab.id);
                }
            });
        });
    }
});
async function startRedirectStopper(tabId) {
    const tabData = await tabsData(tabId);
    chrome.tabs.onCreated.addListener(async function (tab) {
        if (!(await tabsData(tabId, {}, false, false)))
            return;
        const tabURL = tab.pendingUrl?.toLowerCase();
        if (tabURL) {
            if (tabURL.startsWith("chrome://newtab"))
                return;
        }
        if (tab.incognito)
            return;
        if (tab.windowId === tabData.windowId && tabData.windowActive) {
            tabData.latestCreatedTab = tab.id;
        }
    });
    chrome.tabs.onActivated.addListener(async function (tab) {
        if (!(await tabsData(tabId, {}, false, false)))
            return;
        if (tab.tabId === tabData.latestCreatedTab &&
            (tabData.active || tabData.windowActive)) {
            await chrome.tabs.update(tabId, { active: true }).catch((e) => e);
            await chrome.tabs.remove(tab.tabId).catch((e) => e);
        }
        else if (tab.tabId === tabId) {
            console.log(`Tab-${tabData.tabId} is active`);
            tabData.active = true;
        }
        else {
            console.log(`Tab-${tabData.tabId} is not active`);
            tabData.active = false;
        }
        chrome.storage.local.get(["tabsData"], (result) => {
            let value = result["tabsData"];
            if (value?.[tabId]?.tabId == undefined)
                return;
            chrome.tabs.query({ active: true }, (tabs) => {
                tabData.windowActive = tabs.some((tab) => tab.id === tabId);
                tabsData(tabId, tabData);
            });
        });
    });
}
function stopRedirectStopper(tabId) {
    chrome.storage.local.remove(["applicationIsOn" + tabId]).catch((e) => e);
    tabsData(tabId, {}, true);
}
function tabsData(tabId, data = {}, remove = false, create = true) {
    return new Promise((resolve) => {
        chrome.storage.local.get(["tabsData"], async (result) => {
            let value = { ...result["tabsData"] };
            if (create) {
                if (value == undefined)
                    value = {};
                if (value[tabId] == undefined)
                    value[tabId] = {};
                for (let [key, v] of Object.entries(data)) {
                    value[tabId][key] = v;
                }
            }
            else {
                if (!value?.[tabId])
                    return resolve(undefined);
                return resolve(value[tabId]);
            }
            if (remove)
                delete value[tabId];
            await chrome.storage.local.set({
                tabsData: value,
            });
            resolve(value[tabId]);
        });
    });
}
function savedUrlsTabData(tabId, data = {}, remove = false, create = true) {
    return new Promise((resolve) => {
        chrome.storage.local.get(["savedUrlsTabData"], async (result) => {
            let value = result["savedUrlsTabData"];
            if (create) {
                if (value == undefined)
                    value = {};
                if (value[tabId] == undefined)
                    value[tabId] = {};
                for (let [key, v] of Object.entries(data)) {
                    value[tabId][key] = v;
                }
            }
            else {
                if (!value?.[tabId])
                    return resolve(undefined);
                return resolve(value[tabId]);
            }
            if (remove)
                delete value[tabId];
            await chrome.storage.local.set({
                savedUrlsTabData: value,
            });
            resolve(value[tabId]);
        });
    });
}
setInterval(() => {
    // clear all storage
    //chrome.storage.local.clear().then(() => console.log("cleared"));
    chrome.storage.local.get(null, console.log);
}, 6000);
