const extensionTabs = [];
let keepAlive;
const builtInURLs = [
    "https://google.com/",
    "chrome://",
    "chrome-extension://",
    "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values",
    "https://github.com/Tyson3101/",
    "https://chrome.google.com/webstore/detail/redirect-blocker/egmgebeelgaakhaoodlmnimbfemfgdah",
];
let allowedURLs = [...builtInURLs];
const initialSettings = {
    tabExclusive: false,
    preventURLChange: false,
    savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
    allowedURLs: ["https://youtube.com/@Tyson3101"],
    shortCut: ["alt", "shift", "s"],
};
let settings = initialSettings;
chrome.tabs.onCreated.addListener(async (tab) => {
    const extTab = extensionTabs.find((t) => t.active && t.windowId === tab.windowId);
    if (!extTab)
        return;
    let createdTabActive = tab.active;
    if (extTab.windowId === tab.windowId) {
        await chrome.tabs.update(extTab.id, { active: true }).catch(() => null);
        let intMs = 0;
        let urlPropertiesInterval = setInterval(async () => {
            const updatedTab = await chrome.tabs.get(tab.id).catch(() => null);
            if (!updatedTab)
                return clearInterval(urlPropertiesInterval);
            intMs += 20;
            if (updatedTab.url || updatedTab.pendingUrl) {
                clearInterval(urlPropertiesInterval);
                checkRedirect(updatedTab).catch(() => null);
            }
            else if (intMs >= 1000) {
                return clearInterval(urlPropertiesInterval);
            }
        }, 20);
    }
    async function checkRedirect(tab) {
        const combinedURLs = [
            ...allowedURLs,
            ...settings.savedURLs,
            new URL(extTab.url).origin,
        ];
        if (isURLMatch(combinedURLs, tab.pendingUrl || tab.url)) {
            if (createdTabActive) {
                return await chrome.tabs
                    .update(tab.id, { active: true })
                    .catch(() => null);
            }
        }
        else
            await chrome.tabs.remove(tab.id).catch(() => null);
    }
});
chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
    let extTab = extensionTabs.find((t) => t.id === tabId);
    if (isURLMatch(settings.savedURLs, tab.url)) {
        if (!extTab)
            return (extTab = (await updateExtensionTab(tab, true)));
    }
    if (isURLMatch([...settings.savedURLs, ...allowedURLs], tab.url)) {
        if (extTab) {
            if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
                if (!settings.tabExclusive)
                    return removeExtensionTab(extTab, true);
            }
            return updateExtensionTab(tab);
        }
    }
    if (!extTab || !tab.url)
        return;
    if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
        const url = new URL(tab.url);
        if (new URL(extTab.url).hostname !== url.origin) {
            if (settings.preventURLChange) {
                return chrome.tabs.update(tabId, { url: extTab.url }).catch(() => null);
            }
            else {
                if (!settings.tabExclusive) {
                    return removeExtensionTab(extTab, true);
                }
            }
        }
    }
    if (extTab)
        updateExtensionTab(tab);
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
    if (!tab)
        return;
    for (let extTab of extensionTabs) {
        if (extTab.id === tab.id) {
            updateExtensionTab(tab);
            continue;
        }
        if (extTab.active && extTab.windowId === tab.windowId) {
            const extChromeTab = await chrome.tabs.get(extTab.id).catch(() => null);
            if (!extChromeTab)
                return removeExtensionTab(extTab);
            updateExtensionTab(extChromeTab);
            continue;
        }
    }
});
chrome.windows.onCreated.addListener(async (window) => {
    const extTab = extensionTabs.find((t) => t.active && t.windowActive);
    if (!extTab)
        return;
    const popupTab = (await chrome.tabs.query({ windowId: window.id }).catch(() => null))?.[0];
    if (window.type === "popup" && popupTab) {
        const combinedURLs = [
            ...allowedURLs,
            ...settings.savedURLs,
            new URL(extTab.url).origin,
        ];
        if (!isURLMatch(combinedURLs, popupTab.pendingUrl || popupTab.url)) {
            chrome.windows.remove(window.id).catch(() => null);
        }
    }
});
chrome.tabs.onRemoved.addListener((tabId) => {
    const extTab = extensionTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    removeExtensionTab(extTab);
});
async function onTabMoved(tabId) {
    const extTab = extensionTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    updateExtensionTab(tab);
}
chrome.tabs.onAttached.addListener(onTabMoved);
chrome.tabs.onDetached.addListener(onTabMoved);
chrome.storage.onChanged.addListener((changes) => {
    const newSettings = changes.settings?.newValue;
    if (newSettings) {
        allowedURLs = [...newSettings.allowedURLs, ...builtInURLs];
        settings = changes.settings.newValue;
    }
    if (changes.extensionTabs?.newValue) {
        setExtensionTabs(changes.extensionTabs.newValue);
    }
});
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.toggle === true) {
        const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))?.[0];
        if (!tab)
            return;
        const extTab = extensionTabs.find((t) => t.id === tab.id);
        if (extTab) {
            removeExtensionTab(extTab, true);
        }
        else {
            updateExtensionTab(tab, true);
        }
    }
});
async function setExtensionTabs(newExtensionTabs) {
    extensionTabs.splice(0, extensionTabs.length, ...newExtensionTabs);
    saveExtTabs();
}
async function updateExtensionTab(tab, instantSave = false) {
    if (!tab)
        return;
    let extTabIndex = extensionTabs.findIndex((t) => t.id === tab.id);
    const updatedTabData = {
        id: tab.id,
        url: tab.url,
        active: tab.active,
        windowId: tab.windowId,
        windowActive: tab.windowId === (await getCurrentWindowId()),
    };
    if (extTabIndex >= 0) {
        extensionTabs[extTabIndex] = updatedTabData;
    }
    else {
        extensionTabs.push(updatedTabData);
    }
    if (instantSave)
        saveExtTabs();
    else
        debouncedSaveExtTabs();
    return updatedTabData;
}
function removeExtensionTab(extTab, instantSave = false) {
    const extTabIndex = extensionTabs.findIndex((t) => t.id === extTab.id);
    if (extTabIndex < 0)
        return;
    extensionTabs.splice(extTabIndex, 1);
    if (instantSave)
        saveExtTabs();
    else
        debouncedSaveExtTabs();
}
function saveExtTabs() {
    const extTabsSet = [...new Set(extensionTabs.map((t) => t.id))].map((id) => extensionTabs.find((t) => t.id === id));
    extensionTabs.splice(0, extensionTabs.length, ...extTabsSet);
    console.log("extTabs", extensionTabs);
    chrome.storage.local.set({ extensionTabs: extensionTabs });
}
let debouncedSaveExtTabs = debounce(() => {
    saveExtTabs();
    if (!extensionTabs.length) {
        if (keepAlive)
            clearInterval(keepAlive);
        keepAlive = null;
        return;
    }
    if (!keepAlive)
        persistServiceWorker();
}, 5000);
function persistServiceWorker() {
    if (keepAlive)
        clearInterval(keepAlive);
    keepAlive = setInterval(() => {
        checkTabs();
    }, 1000 * 25);
}
function checkTabs() {
    chrome.tabs.query({}).then((tabs) => {
        for (let i = extensionTabs.length - 1; i >= 0; i--) {
            if (!tabs.find((t) => t.id === extensionTabs[i].id)) {
                extensionTabs.splice(i, 1);
                console.log("Found non-existant tab");
            }
        }
        debouncedSaveExtTabs();
    });
}
function isURLMatch(urls, url) {
    if (!url)
        return false;
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
async function getCurrentWindowId() {
    const window = await chrome.windows.getCurrent();
    return window.id;
}
(function initializeExtension() {
    chrome.storage.sync.get("settings", (res) => {
        let savedSettings = res.settings;
        if (!savedSettings) {
            savedSettings = initialSettings;
            chrome.storage.sync.set({ settings: initialSettings });
        }
        allowedURLs = [...savedSettings.allowedURLs, ...builtInURLs];
        settings = savedSettings;
    });
    chrome.storage.local.get("extensionTabs", (res) => {
        if (!res.extensionTabs) {
            chrome.storage.local.set({ extensionTabs: [] });
        }
        else {
            setExtensionTabs(res.extensionTabs);
        }
        if (extensionTabs.length)
            persistServiceWorker();
    });
})();
