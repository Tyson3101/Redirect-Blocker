const extTabs = [];
const builtInURLs = ["https://google.com/", "chrome://", "chrome-extension://"];
let allowedURLs = [...builtInURLs];
const defaultSettings = {
    tabExclusive: false,
    preventURLChange: false,
    savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
    allowedURLs: ["https://youtube.com/@Tyson3101"],
    shortCut: ["alt", "shift", "s"],
};
let settings = defaultSettings;
chrome.tabs.onCreated.addListener(async (tab) => {
    const extTab = extTabs.find((t) => t.active && t.windowId === tab.windowId);
    if (!extTab)
        return;
    let createdTabActive = tab.active;
    if (extTab.windowId === tab.windowId) {
        await chrome.tabs.update(extTab.id, { active: true }).catch(() => null);
        let intMs = 0;
        let urlPropertiesInterval = setInterval(() => {
            chrome.tabs.get(tab.id, (updatedTab) => {
                intMs += 20;
                if (updatedTab.url || updatedTab.pendingUrl) {
                    clearInterval(urlPropertiesInterval);
                    checkRedirect(updatedTab).catch(() => null);
                }
                else if (intMs >= 1000) {
                    return clearInterval(urlPropertiesInterval);
                }
            });
        }, 20);
    }
    async function checkRedirect(tab) {
        const combinedURLs = [...allowedURLs, ...settings.savedURLs];
        if (urlCheck(combinedURLs, tab.pendingUrl || tab.url)) {
            if (createdTabActive) {
                return await chrome.tabs.update(tab.id, { active: true });
            }
        }
        else
            await chrome.tabs.remove(tab.id);
    }
});
chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
    let extTab = extTabs.find((t) => t.id === tabId);
    if (urlCheck(settings.savedURLs, tab.url)) {
        if (!extTab)
            return (extTab = (await extTabModify(tab)));
    }
    if (urlCheck([...settings.savedURLs, ...allowedURLs], tab.url)) {
        if (extTab) {
            if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
                if (!settings.tabExclusive)
                    return removeExtTab(extTab);
            }
            return extTabModify(tab, extTab);
        }
    }
    if (!extTab || !tab.url)
        return;
    if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
        const url = new URL(tab.url);
        if (new URL(extTab.url).hostname !== url.origin) {
            if (settings.preventURLChange) {
                return chrome.tabs.update(tabId, { url: extTab.url });
            }
            else {
                if (!settings.tabExclusive) {
                    return removeExtTab(extTab);
                }
            }
        }
    }
    if (extTab)
        extTabModify(tab, extTab);
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    for (let extTab of extTabs) {
        if (extTab.id === tab.id) {
            extTabModify(tab, extTab);
            continue;
        }
        if (extTab.active && extTab.windowId === tab.windowId) {
            const extChromeTab = await chrome.tabs.get(extTab.id).catch(() => null);
            if (!extChromeTab)
                return removeExtTab(extTab);
            extTabModify(extChromeTab, extTab);
            continue;
        }
    }
});
chrome.windows.onCreated.addListener(async (window) => {
    const extTab = extTabs.find((t) => t.active && t.windowActive);
    if (!extTab || window.incognito)
        return;
    const windowTabs = await chrome.tabs.query({ windowId: window.id });
    if (windowTabs.length === 0 || window.type === "popup")
        return chrome.windows.remove(window.id);
});
chrome.tabs.onAttached.addListener(async (tabId) => {
    const extTab = extTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    const tab = await chrome.tabs.get(tabId);
    extTab.windowId = tab.windowId;
    extTabModify(tab, extTab);
});
chrome.tabs.onDetached.addListener(async (tabId) => {
    const extTab = extTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    const tab = await chrome.tabs.get(tabId);
    extTab.windowId = tab.windowId;
    extTabModify(tab, extTab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
    const extTab = extTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    removeExtTab(extTab);
});
async function extTabModify(tab, update) {
    if (!tab)
        return;
    if (Array.isArray(tab)) {
        extTabs.splice(0, extTabs.length, ...tab);
        saveExtensionTabsToStorage();
        return extTabs;
    }
    let extTabIndex = extTabs.findIndex((t) => t.id === tab.id);
    let extTab = extTabs[extTabIndex];
    if (extTabIndex >= 0 && !update)
        return extTabs[extTabIndex];
    if (update) {
        extTabs[extTabIndex] = {
            ...extTabs[extTabIndex],
            ...update,
            url: tab.url,
            active: tab.active,
            windowActive: tab.windowId === (await getCurrentWindowId()),
        };
        saveExtensionTabsToStorage();
        return extTabs[extTabIndex];
    }
    else {
        extTab = {
            id: tab.id,
            windowId: tab.windowId,
            url: tab.url,
            active: tab.active,
            windowActive: tab.windowId === (await getCurrentWindowId()),
        };
        extTabs.push(extTab);
        saveExtensionTabsToStorage();
        return extTab;
    }
}
function removeExtTab(extTab) {
    const extTabIndex = extTabs.findIndex((t) => t.id === extTab.id);
    if (extTabIndex < 0)
        return;
    extTabs.splice(extTabIndex, 1);
    saveExtensionTabsToStorage();
}
function saveExtensionTabsToStorage() {
    const extTabsSet = [...new Set(extTabs.map((t) => t.id))].map((id) => extTabs.find((t) => t.id === id));
    extTabs.splice(0, extTabs.length, ...extTabsSet);
    debounce(() => {
        chrome.storage.local.set({ extensionTabs: extTabs });
    }, 500)();
}
async function getCurrentWindowId() {
    const window = await chrome.windows.getCurrent();
    return window.id;
}
function urlCheck(urls, url) {
    const normalizeUrl = (url) => url
        .replace(/^https?:\/\/(www\.)?(ww\d+\.)?/, "https://")
        .replace(/\/([^?]+).*$/, "/$1")
        .replace(/\/$/, "")
        .toLowerCase();
    const normalizedUrl = normalizeUrl(url);
    for (const currentUrl of urls) {
        const normalizedCurrentUrl = normalizeUrl(currentUrl);
        if (normalizedUrl === normalizedCurrentUrl ||
            normalizedUrl.startsWith(normalizedCurrentUrl + "/")) {
            return true;
        }
    }
    return false;
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
chrome.storage.onChanged.addListener((changes) => {
    const newSettings = changes.settings?.newValue;
    if (newSettings) {
        allowedURLs = [...newSettings.allowedURLs, ...builtInURLs];
        settings = changes.settings.newValue;
    }
    if (changes.extensionTabs?.newValue) {
        extTabModify(changes.extensionTabs.newValue);
    }
});
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.toggle === true) {
        const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))?.[0];
        if (!tab)
            return;
        const extTab = extTabs.find((t) => t.id === tab.id);
        if (extTab) {
            removeExtTab(extTab);
        }
        else {
            extTabModify(tab);
        }
    }
});
async function createOffscreen() {
    if (await chrome.offscreen.hasDocument?.())
        return;
    await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "Keep service worker running",
    });
}
chrome.runtime.onStartup.addListener(() => {
    createOffscreen();
});
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.keepAlive)
        console.log("Ping Pong!");
});
(function init() {
    chrome.storage.sync.get("settings", (res) => {
        let savedSettings = res.settings;
        if (!savedSettings) {
            savedSettings = defaultSettings;
            chrome.storage.sync.set({ settings: defaultSettings });
        }
        allowedURLs = [...savedSettings.allowedURLs, ...builtInURLs];
        settings = savedSettings;
    });
    chrome.storage.local.get("extensionTabs", (res) => {
        if (!res.extensionTabs) {
            chrome.storage.local.set({ extensionTabs: [] });
        }
        extTabModify(res.extensionTabs);
    });
    setInterval(checkTabs, 1000 * 60 * 5);
    function checkTabs() {
        chrome.tabs.query({}, (tabs) => {
            for (let i = extTabs.length - 1; i >= 0; i--) {
                const extTab = extTabs[i];
                const foundTab = tabs.find((t) => t.id === extTab.id);
                if (!foundTab) {
                    extTabs.splice(i, 1);
                    saveExtensionTabsToStorage();
                }
            }
        });
    }
})();
setInterval(() => {
    console.log("Extension Tabs:");
    console.log(extTabs);
}, 6000);
