let shortCutToggleSingleKeys = ["alt", "shift", "s"];
let shortCutToggleAllKeys = ["alt", "shift", "a"];
let pressedKeys = [];
chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings;
    if (!settings)
        return;
    if (!settings.shortCutToggleSingleKeys || !settings.shortCutToggleAllKeys) {
        if (!settings.shortCutToggleSingleKeys)
            settings.shortCutToggleSingleKeys = shortCutToggleSingleKeys;
        if (!settings.shortCutToggleAllKeys)
            settings.shortCutToggleAllKeys = shortCutToggleAllKeys;
        chrome.storage.sync.set({ settings });
    }
    shortCutToggleSingleKeys = settings.shortCutToggleSingleKeys;
    shortCutToggleAllKeys = settings.shortCutToggleAllKeys;
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
        const settings = changes.settings.newValue;
        if (!settings)
            return;
        shortCutToggleSingleKeys = settings.shortCutToggleSingleKeys;
        shortCutToggleAllKeys = settings.shortCutToggleAllKeys;
    }
});
shortCutListener();
function shortCutListener() {
    let pressedKeys = [];
    function debounce(cb, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                cb(...args);
            }, delay);
        };
    }
    const checkKeys = (keysToCheck, waitDebounce = true, delay = 700) => {
        return new Promise((resolve) => {
            function debounceCB() {
                if (!keysToCheck?.length)
                    return resolve(false);
                if (pressedKeys.length == keysToCheck.length) {
                    let match = true;
                    for (let i = 0; i < pressedKeys.length; i++) {
                        if (pressedKeys[i] != keysToCheck[i]) {
                            match = false;
                            break;
                        }
                    }
                    resolve(match);
                }
                else
                    resolve(false);
            }
            if (waitDebounce)
                debounce(debounceCB, delay)();
            else
                debounceCB();
        });
    };
    document.addEventListener("keydown", async (e) => {
        if (!e.key)
            return;
        pressedKeys.push(e.key.toLowerCase());
        if (await checkKeys(shortCutToggleSingleKeys)) {
            chrome.runtime.sendMessage({ toggleSingle: true });
        }
        else if (await checkKeys(shortCutToggleAllKeys, false)) {
            chrome.runtime.sendMessage({ toggleAll: true });
        }
        pressedKeys = [];
    });
}
let tabId = null;
let isTabToggledOn = false;
let isSameTabRedirectsPrevented = false;
let combinedURLs = [];
chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
    tabId = response.tabId;
    beginPreventionOfSameTabRedirects();
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleTab") {
        isTabToggledOn = !!request.isToggledOn;
        if (isTabToggledOn) {
            beginPreventionOfSameTabRedirects();
        }
        else {
            endPreventionOfSameTabRedirects();
        }
    }
});
function preventSameTabRedirect(event) {
    const aTag = event.target;
    if (!isTabToggledOn || !isSameTabRedirectsPrevented)
        return;
    if (aTag && aTag.href) {
        if (!isURLMatchSameTab(combinedURLs, aTag.href)) {
            event.preventDefault();
        }
    }
}
function beginPreventionOfSameTabRedirects() {
    if (!isTabToggledOn || !isSameTabRedirectsPrevented)
        return;
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === "childList") {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLAnchorElement) {
                        node.addEventListener("click", preventSameTabRedirect);
                    }
                });
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll("a").forEach((link) => {
        link.removeEventListener("click", preventSameTabRedirect);
        link.addEventListener("click", preventSameTabRedirect);
    });
}
function endPreventionOfSameTabRedirects() {
    document.querySelectorAll("a").forEach((link) => {
        link.removeEventListener("click", preventSameTabRedirect);
    });
}
function isURLMatchSameTab(urls, url) {
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
chrome.storage.local.get("extensionTabs", (result) => {
    const extensionTabs = result.extensionTabs;
    if (extensionTabs) {
        const tabIsToggled = extensionTabs.find((tab) => tab.id == tabId);
        isTabToggledOn = !!tabIsToggled;
        if (isTabToggledOn)
            beginPreventionOfSameTabRedirects();
        else
            endPreventionOfSameTabRedirects();
    }
});
chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings;
    if (settings) {
        if (settings.preventSameTabRedirects == null) {
            isSameTabRedirectsPrevented = false;
            settings.preventSameTabRedirects = false;
            chrome.storage.sync.set({ settings });
        }
        else {
            isSameTabRedirectsPrevented = settings.preventSameTabRedirects;
            combinedURLs = [
                ...settings.allowedURLs,
                ...settings.savedURLs,
                window.origin,
            ];
        }
        beginPreventionOfSameTabRedirects();
    }
});
chrome.runtime.sendMessage({ action: "getTabToggledState" }, (response) => {
    isTabToggledOn = !!response.isToggled;
    if (isTabToggledOn)
        beginPreventionOfSameTabRedirects();
    else
        endPreventionOfSameTabRedirects();
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.extensionTabs) {
        const extensionTabs = changes.extensionTabs.newValue;
        if (extensionTabs) {
            const tabIsToggled = extensionTabs.find((tab) => tab.id == tabId);
            isTabToggledOn = !!tabIsToggled;
            if (isTabToggledOn)
                beginPreventionOfSameTabRedirects();
            else
                endPreventionOfSameTabRedirects();
        }
    }
    if (changes.settings) {
        const settings = changes.settings.newValue;
        if (settings) {
            isSameTabRedirectsPrevented = settings.preventSameTabRedirects;
            if (isTabToggledOn && isSameTabRedirectsPrevented)
                beginPreventionOfSameTabRedirects();
            else
                endPreventionOfSameTabRedirects();
            combinedURLs = [
                ...settings.allowedURLs,
                ...settings.savedURLs,
                window.origin,
            ];
        }
    }
});
