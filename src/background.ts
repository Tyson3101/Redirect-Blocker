const tabsData: {
  [key: string]: {
    tabId: number;
    active: boolean;
    latestCreatedTab?: number;
  };
} = {};

chrome.runtime.onMessage.addListener(
  (value: { tabId: number; isOn: boolean }) => {
    if (value.isOn) {
      tabsData[value.tabId] = {
        tabId: value.tabId,
        active: true,
      };
      startRedirectStopper(value.tabId);
    } else stopRedirectStopper(value.tabId);
  }
);

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-application") {
    console.log("Running command: ", command);
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
        } else {
          stopRedirectStopper(tab.id);
        }
      });
    });
  }
});

function startRedirectStopper(tabId: number) {
  if (!tabsData[tabId]) return;
  const tabData = tabsData[tabId];
  chrome.tabs.onCreated.addListener(async function (tab) {
    if (!tabsData[tabId]) return chrome.tabs.onCreated.removeListener(this);
    tabData.latestCreatedTab = tab.id;
  });
  chrome.tabs.onActivated.addListener(async function (tab) {
    if (!tabsData[tabId]) return chrome.tabs.onCreated.removeListener(this);
    if (tab.tabId === tabData.latestCreatedTab && tabData.active) {
      await chrome.tabs.update(tabId, { active: true }).catch((e) => e);
      await chrome.tabs.remove(tab.tabId).catch((e) => e);
    } else if (tab.tabId === tabId) {
      tabData.active = true;
    } else {
      tabData.active = false;
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => stopRedirectStopper(tabId));
}

function stopRedirectStopper(tabId: number) {
  chrome.storage.local.remove(["applicationIsOn" + tabId]).catch((e) => e);
  delete tabsData[tabId];
}

function stopAllRedirectStoppers() {
  for (const tabId in tabsData) stopRedirectStopper(parseInt(tabId));
}

setInterval(() => {
  chrome.storage.local.get(null, (result) => {
    console.log(result, tabsData);
  });
}, 2000);
