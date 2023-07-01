const toggleBtn = document.querySelector(".toggleBtn");
const savedURLsInput = document.querySelector("#savedURLs");
const allowedURLsInput = document.querySelector("#allowedURLS");
const tabExclusiveSelect = document.querySelector("#turnOffOnWhen");
const preventURLSelect = document.querySelector("#preventURLChange");
const shortCutInput = document.querySelector("#shortCutInput");
const shortCutBtn = document.querySelector("#shortCutBtn");
const shortCutDisplay = document.querySelector("#shortCutDisplay");
const nextSettings = document.querySelector("#nextSettings");
const backSettings = document.querySelector("#backSettings");
const pageNumber = document.querySelector("#pageNumber");
chrome.storage.local.get("extensionTabs", async ({ extensionTabs }) => {
    if (!extensionTabs)
        extensionTabs = [];
    const activeTab = (await chrome.tabs
        .query({ active: true, currentWindow: true })
        .catch(() => null))?.[0];
    if (!activeTab)
        return;
    const extTab = extensionTabs.find((tab) => tab.id === activeTab.id);
    if (extTab) {
        changeToggleButton(true);
    }
    else {
        changeToggleButton(false);
    }
});
toggleBtn.onclick = async () => {
    const activeTab = (await chrome.tabs
        .query({ active: true, currentWindow: true })
        .catch(() => null))?.[0];
    if (!activeTab)
        return;
    chrome.storage.local.get("extensionTabs", async ({ extensionTabs }) => {
        if (!extensionTabs)
            extensionTabs = [];
        if (extensionTabs.find((tab) => tab.id === activeTab.id)) {
            extensionTabs = extensionTabs.filter((tab) => tab.id !== activeTab.id);
            chrome.storage.local.set({ extensionTabs }).catch(console.error);
            changeToggleButton(false);
        }
        else {
            extensionTabs.push({
                id: activeTab.id,
                windowId: activeTab.windowId,
                url: activeTab.url,
                active: activeTab.active,
                windowActive: activeTab.windowId === (await chrome.windows.getCurrent()).id,
            });
            chrome.storage.local.set({ extensionTabs }).catch(console.error);
            changeToggleButton(true);
        }
    });
};
shortCutBtn.onclick = () => {
    document.querySelector(".shortCut").classList.toggle("remove");
};
chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings;
    savedURLsInput.value = settings.savedURLs.join("\n");
    allowedURLsInput.value = settings.allowedURLs.join("\n");
    tabExclusiveSelect.value = settings.tabExclusive ? "tab" : "url";
    preventURLSelect.value = settings.preventURLChange ? "true" : "false";
    shortCutInput.value = settings.shortCut.join(" + ");
    shortCutDisplay.innerText = `${settings.shortCut.join(" + ")}`;
    savedURLsInput.onchange = () => {
        const savedURLs = savedURLsInput.value
            .trim()
            .toLowerCase()
            .split("\n")
            .filter(isValidURL);
        chrome.storage.sync.set({ settings: { ...settings, savedURLs } });
    };
    allowedURLsInput.onchange = () => {
        const allowedURLs = allowedURLsInput.value
            .trim()
            .toLowerCase()
            .split("\n")
            .filter(isValidURL);
        chrome.storage.sync.set({ settings: { ...settings, allowedURLs } });
    };
    tabExclusiveSelect.onchange = () => {
        const tabExclusive = tabExclusiveSelect.value === "tab";
        chrome.storage.sync.set({ settings: { ...settings, tabExclusive } });
    };
    preventURLSelect.onchange = () => {
        const preventURLChange = preventURLSelect.value === "true";
        chrome.storage.sync.set({ settings: { ...settings, preventURLChange } });
    };
    shortCutInput.onchange = () => {
        const shortCut = shortCutInput.value
            .trim()
            .split("+")
            .map((s) => s.trim().toLowerCase());
        chrome.storage.sync.set({ settings: { ...settings, shortCut } });
    };
});
nextSettings.onclick = () => {
    const settingPage = document.querySelectorAll(".settingsPage");
    const active = [...settingPage].find((page) => page.classList.contains("active"));
    const next = (() => {
        const nextIndex = parseInt(active.dataset["settingindex"]) + 1;
        if (nextIndex >= settingPage.length)
            return settingPage[0];
        return settingPage[nextIndex];
    })();
    pageNumber.innerText = `${parseInt(next.dataset["settingindex"]) + 1}/5`;
    active.classList.remove("active");
    next.classList.add("active");
};
backSettings.onclick = () => {
    const settingPage = document.querySelectorAll(".settingsPage");
    const active = [...settingPage].find((page) => page.classList.contains("active"));
    const last = (() => {
        const lastIndex = parseInt(active.dataset["settingindex"]) - 1;
        if (lastIndex < 0) {
            pageNumber.innerText = `5/5`;
            return settingPage[4];
        }
        else {
            pageNumber.innerText = `${parseInt(active.dataset["settingindex"])}/5`;
            return settingPage[lastIndex];
        }
    })();
    active.classList.remove("active");
    last.classList.add("active");
};
function changeToggleButton(result) {
    toggleBtn.innerText = result ? "Turn Off" : "Turn On";
    toggleBtn.classList.remove(result ? "off" : "on");
    toggleBtn.classList.add(result ? "on" : "off");
    toggleBtn.classList.remove("loading");
}
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    }
    catch (err) {
        return false;
    }
}
