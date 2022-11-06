const builtInSavedUrls = [
  "https://chrome.google.com/webstore/detail/redirect-stopper/egmgebeelgaakhaoodlmnimbfemfgdah",
  "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values",
];

chrome.storage.local.get(
  [
    "savedURLS",
    "tabExclusive",
    "preventURLChange",
    "shortCutKeys",
    "allowedURLS",
  ],
  (value) => {
    if (value["savedURLS"] == undefined) {
      chrome.storage.local.set({
        savedURLS: ["https://soap2day.day/"],
      });
    }
    if (value["tabExclusive"] == undefined) {
      chrome.storage.local.set({ tabExclusive: "tab" });
    }
    if (value["preventURLChange"] == undefined) {
      chrome.storage.local.set({ preventURLChange: "false" });
    }
    if (value["shortCutKeys"] == undefined) {
      chrome.storage.local.set({ shortCutKeys: ["alt", "shift", "s"] });
    }
    if (value["allowedURLS"] == undefined) {
      chrome.storage.local.set({
        allowedURLS: ["https://youtube.com/@Tyson3101"],
      });
    }
  }
);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  function turnOn(tabIdtoTurnOn: number) {
    chrome.storage.local.set({
      ["applicationIsOn" + tabIdtoTurnOn]: true,
    });
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      await tabsData(tabIdtoTurnOn, {
        tabId: tabIdtoTurnOn,
        active: true,
        windowId: tabs[0]?.windowId,
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
  if (!changeInfo.url) return;
  if (!changeInfo.url.toLowerCase().includes("chrome://")) {
    chrome.storage.local.get(["savedURLS"], async (value) => {
      savedUrlsTabData(tabId, {
        tabId,
        lastURL: changeInfo.url,
      });
      if (
        value["savedURLS"]?.some((url: string) =>
          changeInfo.url
            .toLowerCase()
            .replace("www.", "")
            ?.includes(url.toLowerCase().replace("www.", ""))
        )
      ) {
        try {
          if (
            changeInfo.url.includes(
              new URL(
                (await savedUrlsTabData(tabId, {}, false, false))?.lastURL
              ).origin
            )
          ) {
            return;
          }
          turnOn(tabId);
        } catch (e) {
          turnOn(tabId);
        }
      }
    });
  }
  const tabData = await tabsData(tabId, {}, false, false);
  if (!tabData) return;
  chrome.storage.local.get(["tabExclusive"], async ({ tabExclusive }) => {
    if (tabExclusive !== "tab") {
      if (
        new URL(tabData.lastURL).hostname !== new URL(changeInfo.url).hostname
      ) {
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

chrome.runtime.onMessage.addListener(
  async (
    value: {
      tabId: number;
      isOn: boolean;
      windowId: number;
      lastURL: string;
      shortCut?: boolean;
      getTabID?: boolean;
      keepAlive?: boolean;
    },
    _,
    sendResponse
  ) => {
    if (value.keepAlive) {
      return sendResponse(true);
    } else if (value.getTabID) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) return;
        await chrome.tabs
          .sendMessage(tabs[0].id, { id: tabs[0].id })
          .catch((e) => e);
        chrome.storage.local.get(["applicationIsOn" + tabs[0].id], (result) => {
          let isOn = false;
          let value = result["applicationIsOn" + tabs[0].id];
          if (value) isOn = true;
          chrome.tabs.sendMessage(tabs[0].id, { isOn }).catch((e) => e);
        });
      });
      return sendResponse(true);
    } else if (value.shortCut === true) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        chrome.storage.local.get(
          ["applicationIsOn" + tab.id],
          async (result) => {
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
            } else {
              stopRedirectStopper(tab.id);
            }
          }
        );
      });
    } else if (value.isOn) {
      await tabsData(value.tabId, {
        tabId: value.tabId,
        active: true,
        windowActive: true,
        windowId: value.windowId,
        lastURL: value.lastURL,
      });
      startRedirectStopper(value.tabId);
    } else stopRedirectStopper(value.tabId);
    return sendResponse(true);
  }
);

async function startRedirectStopper(tabId: number) {
  chrome.storage.local.set({
    ["applicationIsOn" + tabId]: true,
  });
  const tabData = await tabsData(tabId);
  chrome.tabs.sendMessage(tabId, { isOn: true }).catch((e) => e);
  let checkUrls = [];
  chrome.storage.local.get(["allowedURLS"], ({ allowedURLS }) => {
    checkUrls = [...builtInSavedUrls, ...allowedURLS];
  });
  chrome.storage.onChanged.addListener(({ allowedURLS }) => {
    if (allowedURLS?.newValue?.length) {
      checkUrls = [...builtInSavedUrls, ...allowedURLS.newValue];
    }
  });
  chrome.tabs.onCreated.addListener(async function (tab) {
    if (!(await tabsData(tabId, {}, false, false))) return;
    const tabURL = tab.pendingUrl?.toLowerCase()?.replace("www.", "");
    if (tabURL) {
      if (tabURL.startsWith("chrome://newtab")) return;
    }
    if (tab.incognito) return;
    if (tab.windowId === tabData.windowId && tabData.windowActive) {
      tabData.latestCreatedTab = tab.id;
    }
  });
  chrome.tabs.onActivated.addListener(async function (tab) {
    if (!(await tabsData(tabId, {}, false, false))) return;
    if (
      tab.tabId === tabData.latestCreatedTab &&
      (tabData.active || tabData.windowActive)
    ) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.id !== tab.tabId) return checkIfActive();
        const tabURL = tabs[0]?.url
          ? tabs[0].url?.toLowerCase()?.replace("www.", "")
          : tabs[0]?.pendingUrl?.toLowerCase()?.replace("www.", "");
        if (tabURL) {
          if (tabURL.startsWith("chrome://newtab")) return checkIfActive();
          if (
            checkUrls.some((url: string) =>
              url.toLowerCase().replace("www.", "").startsWith(tabURL)
            )
          )
            return checkIfActive();
        }
        await chrome.tabs.update(tabId, { active: true }).catch((e) => e);
        await chrome.tabs.remove(tab.tabId).catch((e) => e);
      });
    } else checkIfActive();
    function checkIfActive() {
      if (tab.tabId === tabId) {
        console.log(`Tab-${tabData.tabId} is active`);
        tabData.active = true;
      } else {
        console.log(`Tab-${tabData.tabId} is not active`);
        tabData.active = false;
      }
      chrome.storage.local.get(["tabsData"], (result) => {
        let value = result["tabsData"];
        if (value?.[tabId]?.tabId == undefined) return;
        chrome.tabs.query({ active: true }, (tabs) => {
          tabData.windowActive = tabs.some((tab) => tab.id === tabId);
          tabsData(tabId, tabData);
        });
      });
    }
  });
}

function stopRedirectStopper(tabId: number) {
  chrome.storage.local.remove(["applicationIsOn" + tabId]).catch((e) => e);
  chrome.tabs.sendMessage(tabId, { isOn: false }).catch((e) => e);
  tabsData(tabId, {}, true);
}

function tabsData(
  tabId: number,
  data: {
    tabId?: number;
    active?: boolean;
    latestCreatedTab?: number;
    windowActive?: boolean;
    windowId?: number;
    lastURL?: string;
  } = {},
  remove: boolean = false,
  create: boolean = true
): Promise<{
  tabId: number;
  active: boolean;
  windowActive?: boolean;
  windowId?: number;
  latestCreatedTab?: number;
  lastURL?: string;
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["tabsData"], (result) => {
      let value = { ...result["tabsData"] };
      if (create) {
        if (value == undefined) value = {};
        if (value[tabId] == undefined) value[tabId] = {};
        for (let [key, v] of Object.entries(data)) {
          value[tabId][key] = v;
        }
      } else {
        if (!value?.[tabId]) return resolve(undefined);
        return resolve(value[tabId]);
      }
      if (remove) delete value[tabId];
      chrome.storage.local
        .set({
          tabsData: value,
        })
        .then(() => resolve(value[tabId]));
    });
  });
}

function savedUrlsTabData(
  tabId: number,
  data: { tabId?: number; lastURL?: string } = {},
  remove: boolean = false,
  create: boolean = true
): Promise<{ tabId: number; lastURL?: string }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["savedUrlsTabData"], async (result) => {
      let value = result["savedUrlsTabData"];
      if (create) {
        if (value == undefined) value = {};
        if (value[tabId] == undefined) value[tabId] = {};
        for (let [key, v] of Object.entries(data)) {
          value[tabId][key] = v;
        }
      } else {
        if (!value?.[tabId]) return resolve(undefined);
        return resolve(value[tabId]);
      }
      if (remove) {
        delete value[tabId];
      }
      await chrome.storage.local.set({
        savedUrlsTabData: value,
      });
      resolve(value[tabId]);
    });
  });
}

// Keep alive (@wOxxOm stackoverflow https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension)
chrome.runtime.onConnect.addListener((port: any) => {
  if (port.name !== "keepAlive") return;
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(deleteTimer);
  port._timer = setTimeout(forceReconnect, 250e3, port);
});
function onMessage(msg: any, port: any) {
  console.log("received", msg, "from", port.sender);
}
function forceReconnect(port: any) {
  deleteTimer(port);
  port.disconnect();
}
function deleteTimer(port: any) {
  if (port._timer) {
    clearTimeout(port._timer);
    delete port._timer;
  }
}
