interface Tab {
  id: number;
  windowId: number;
  url: string;
  active: boolean;
  windowActive?: boolean;
  savedURL?: boolean;
}

let allTabsModeIsOn = false;
const extensionTabs: Tab[] = [];
const disabledTabs: Tab[] = [];

let keepAlive: ReturnType<typeof setInterval>;

const builtInURLs = [
  "https://google.com/",
  "chrome://",
  "chrome-extension://egmgebeelgaakhaoodlmnimbfemfgdah",
  "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values",
  "https://github.com/Tyson3101/",
  "https://chrome.google.com/webstore/detail/redirect-blocker/egmgebeelgaakhaoodlmnimbfemfgdah",
  "https://tyson3101.com",
];

let allowedURLs = [...builtInURLs];

const initialSettings = {
  tabExclusive: false,
  preventURLChange: false,
  savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
  allowedURLs: ["https://youtube.com/@Tyson3101"],
  shortCutToggleSingleKeys: ["alt", "shift", "s"],
  shortCutToggleAllKeys: ["alt", "shift", "a"],
  onStartup: false,
};

let settings = initialSettings;

// Event Listeners
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get("settings", (res) => {
    const startUpSetting = (res.settings as typeof initialSettings).onStartup;
    if (startUpSetting) {
      chrome.tabs.query({}).then((allTabs) => {
        const tabs = allTabs.filter((t) => t.id) as Tab[];
        extensionTabs.splice(0, extensionTabs.length, ...tabs);
        allTabsModeIsOn = true;
        chrome.storage.local.set({ allTabsModeIsOn: true });
        saveExtTabs();
      });
    }
  });
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const extTab = extensionTabs.find(
    (t) => t.active && t.windowId === tab.windowId
  );
  if (!extTab && !allTabsModeIsOn) return;

  // Incase of bookmark/links 'open in new tab'
  let createdTabActive = tab.active;

  if (!extTab || extTab.windowId === tab.windowId) {
    if (extTab)
      await chrome.tabs.update(extTab.id, { active: true }).catch(() => null);

    // pendingUrl and url properties are not immediately available (TAKES LIKE on average 20ms)
    let intMs = 0;
    let urlPropertiesInterval = setInterval(async () => {
      const updatedTab = await chrome.tabs.get(tab.id).catch(() => null);
      if (!updatedTab) return clearInterval(urlPropertiesInterval);
      intMs += 20;
      if (updatedTab.url || updatedTab.pendingUrl) {
        checkRedirect(updatedTab, extTab).catch(() => null);
        clearInterval(urlPropertiesInterval);
      } else if (intMs >= 1000) {
        return clearInterval(urlPropertiesInterval);
      }
    }, 20);
  }

  async function checkRedirect(tab: chrome.tabs.Tab, extTab: Tab | null) {
    if (extTab) {
      const combinedURLs = [
        ...allowedURLs,
        ...settings.savedURLs,
        new URL(extTab.url).origin,
      ];

      if (isURLMatch(combinedURLs, tab.pendingUrl || tab.url)) {
        if (createdTabActive) {
          await chrome.tabs.update(tab.id, { active: true }).catch(() => null);
        }
        if (allTabsModeIsOn) {
          await updateExtensionTab(tab, true);
        }
        return;
      } else await chrome.tabs.remove(tab.id).catch(() => null);
    } else if (allTabsModeIsOn) {
      await updateExtensionTab(tab, true);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  const disabledTab = disabledTabs.find((t) => t.id === tabId);
  if (disabledTab) {
    if (new URL(disabledTab.url).hostname === new URL(tab.url).hostname) return;
    else removeDisabledTab(disabledTab);
  }

  // Check if saved URL. If so, add to extTabs
  let extTab = extensionTabs.find((t) => t.id === tabId);
  if (isURLMatch(settings.savedURLs, tab.url)) {
    if (!extTab) return (extTab = (await updateExtensionTab(tab, true)) as Tab);
  }

  // Check if URL is allowed (+ saved). If so, return + checks.
  if (isURLMatch([...settings.savedURLs, ...allowedURLs], tab.url)) {
    if (extTab) {
      if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
        if (!settings.tabExclusive && !allTabsModeIsOn)
          return removeExtensionTab(extTab, true);
      }
      return updateExtensionTab(tab);
    }
  }

  // Redirect Same Tab
  if (!extTab || !tab.url) return;
  if (new URL(extTab.url).origin !== new URL(tab.url).origin) {
    const url = new URL(tab.url);
    if (new URL(extTab.url).hostname !== url.origin) {
      if (settings.preventURLChange) {
        return chrome.tabs.update(tabId, { url: extTab.url }).catch(() => null);
      } else {
        if (!settings.tabExclusive && !allTabsModeIsOn) {
          return removeExtensionTab(extTab, true);
        }
      }
    }
  }
  if (extTab) updateExtensionTab(tab);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
  if (!tab) return;
  for (let extTab of extensionTabs) {
    // If ext tab is this tab, then it is active so update
    if (extTab.id === tab.id) {
      updateExtensionTab(tab);
      continue;
    }
    // If tab is active and same window, but not active tab, update.
    if (extTab.active && extTab.windowId === tab.windowId) {
      const extChromeTab = await chrome.tabs.get(extTab.id).catch(() => null);
      if (!extChromeTab) return removeExtensionTab(extTab);
      updateExtensionTab(extChromeTab);
      continue;
    }
  }
});

chrome.windows.onCreated.addListener(async (window) => {
  const extTab = extensionTabs.find((t) => t.active && t.windowActive);
  if (!extTab) return;

  const popupTab = (
    await chrome.tabs.query({ windowId: window.id }).catch(() => null)
  )?.[0];

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
  if (!extTab) return;
  removeExtensionTab(extTab);
  checkTabs();
});

async function onTabMoved(tabId: number) {
  const extTab = extensionTabs.find((t) => t.id === tabId);
  if (!extTab) return;
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

  if (changes.allTabsModeIsOn?.newValue) {
    allTabsModeIsOn = changes.allTabsModeIsOn.newValue;
  }

  if (changes.disabledTabs?.newValue) {
    const newDisabledTabs = changes.disabledTabs.newValue;
    disabledTabs.splice(0, disabledTabs.length, ...newDisabledTabs);

    checkDisabledTabs();
  }
});

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.toggleSingle === true) {
    const tab = (
      await chrome.tabs.query({ active: true, currentWindow: true })
    )?.[0];
    if (!tab) return;
    const extTab = extensionTabs.find((t) => t.id === tab.id);
    if (extTab) {
      removeExtensionTab(extTab, true);
    } else {
      updateExtensionTab(tab, true);
    }
  } else if (message.toggleAll === true) {
    if (allTabsModeIsOn) {
      extensionTabs.splice(0, extensionTabs.length);
      allTabsModeIsOn = false;
    } else {
      const tabs = await chrome.tabs.query({}).catch(() => []);
      extensionTabs.splice(0, extensionTabs.length, ...tabs);
      allTabsModeIsOn = true;
    }
    saveExtTabs();
    chrome.storage.local.set({ allTabsModeIsOn: allTabsModeIsOn });
  }
});

async function setExtensionTabs(newExtensionTabs: Tab[]) {
  extensionTabs.splice(0, extensionTabs.length, ...newExtensionTabs);
  saveExtTabs();
}

// Helper Functions
async function updateExtensionTab(
  tab: chrome.tabs.Tab,
  instantSave: boolean = false
) {
  if (!tab) return;

  let extTabIndex = extensionTabs.findIndex((t) => t.id === tab.id);

  const updatedTabData = {
    id: tab.id,
    url: tab.url,
    active: tab.active,
    windowId: tab.windowId,
    windowActive: tab.windowId === (await getCurrentWindowId()),
    savedURL: isURLMatch(settings.savedURLs, tab.url),
  };

  // If tab exists, update it, else push it
  if (extTabIndex >= 0) {
    extensionTabs[extTabIndex] = updatedTabData;
  } else {
    extensionTabs.push(updatedTabData);
  }

  // Save extTabs
  if (instantSave) saveExtTabs();
  else debouncedSaveExtTabs();

  return updatedTabData;
}

function removeExtensionTab(extTab: Tab, instantSave: boolean = false) {
  const extTabIndex = extensionTabs.findIndex((t) => t.id === extTab.id);
  if (extTabIndex < 0) return;
  extensionTabs.splice(extTabIndex, 1);
  if (instantSave) saveExtTabs();
  else debouncedSaveExtTabs();
}

function removeDisabledTab(disabledTab: Tab) {
  const disabledTabIndex = disabledTabs.findIndex(
    (t) => t.id === disabledTab.id
  );
  if (disabledTabIndex < 0) return;
  disabledTabs.splice(disabledTabIndex, 1);
  checkDisabledTabs();
}

function saveExtTabs() {
  // Remove duplicates of extTabs with set
  const extTabsSet = [...new Set(extensionTabs.map((t) => t.id))].map((id) =>
    extensionTabs.find((t) => t.id === id)
  );

  extensionTabs.splice(0, extensionTabs.length, ...extTabsSet);
  console.log("extTabs", extensionTabs);
  chrome.storage.local.set({ extensionTabs: extensionTabs });

  if (!extensionTabs.length) {
    allTabsModeIsOn = false;
    chrome.storage.local.set({ allTabsModeIsOn: false });
  }
}

let debouncedSaveExtTabs = debounce(() => {
  saveExtTabs();

  // Check if any extTabs left, if not, don't need to persist service worker
  if (!extensionTabs.length) {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
    allTabsModeIsOn = false;
    return;
  }
  if (!keepAlive) persistServiceWorker();
}, 5000);

function persistServiceWorker() {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    checkTabs(); // This calls chrome api, which keeps service worker alive
  }, 1000 * 25); // Acts as a keep alive for service worker (30 sec of inactivty = service worker idle)
}

function checkTabs() {
  chrome.tabs.query({}).then((tabs) => {
    for (let i = extensionTabs.length - 1; i >= 0; i--) {
      // If tab doesn't exist, remove from extTabs (JUST IN CASE)
      if (!tabs.find((t) => t.id === extensionTabs[i].id)) {
        extensionTabs.splice(i, 1);
        console.log("Found non-existant tab");
      }
    }
    debouncedSaveExtTabs();
  });
}

function checkDisabledTabs() {
  chrome.tabs.query({}).then((tabs) => {
    for (let i = disabledTabs.length - 1; i >= 0; i--) {
      // If tab doesn't exist, remove from disabledTabs (JUST IN CASE)
      if (!tabs.find((t) => t.id === disabledTabs[i].id)) {
        disabledTabs.splice(i, 1);
        console.log("Found non-existant disabled tab");
      }
    }
    chrome.storage.local.set({ disabledTabs });
  });
}

// Utility Functions
// Chat GPT
function isURLMatch(urls: string[], url: string) {
  if (!url) return false;
  const normalizeUrl = (url: string) =>
    url
      .replace(/^https?:\/\/(www\.)?(ww\d+\.)?/, "https://")
      .replace(/\/([^?]+).*$/, "/$1")
      .replace(/\/$/, "")
      .toLowerCase();

  const normalizedUrl = normalizeUrl(url);

  for (const currentUrl of urls) {
    const normalizedCurrentUrl = normalizeUrl(currentUrl);

    if (
      normalizedUrl === normalizedCurrentUrl ||
      normalizedUrl.startsWith(normalizedCurrentUrl + "/")
    ) {
      return true; // Match found, return true
    }
  }

  return false; // No match found, return false
}
// END Chat GPT

// Github Co-Pilot
function debounce(func: Function, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
// END Github Co-Pilot

async function getCurrentWindowId() {
  const window = await chrome.windows.getCurrent();
  return window.id;
}

// Initialization
(function initializeExtension() {
  chrome.storage.sync.get("settings", (res) => {
    let savedSettings = res.settings as typeof initialSettings;
    if (!savedSettings) {
      savedSettings = initialSettings;
      chrome.storage.sync.set({ settings: initialSettings });
    }
    allowedURLs = [...savedSettings.allowedURLs, ...builtInURLs];
    settings = savedSettings;
  });
  chrome.storage.local.get(["extensionTabs", "disabledTabs"], async (res) => {
    // Extension Tabs
    if (!res.extensionTabs) {
      chrome.storage.local.set({ extensionTabs: [], allTabsModeIsOn: false });
    } else {
      setExtensionTabs(res.extensionTabs);
    }

    if (extensionTabs.length) {
      persistServiceWorker();
      checkTabs();
    }

    // Disabled Tabs
    if (!res.disabledTabs) {
      chrome.storage.local.set({ disabledTabs: [] });
    } else {
      const disabledTabs = res.disabledTabs as Tab[];
      disabledTabs.splice(0, disabledTabs.length, ...disabledTabs);
      checkDisabledTabs();
    }
  });
})();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "dist/popup/install.html" });
  }
});
