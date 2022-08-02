let isOn = false;
let mainTab;
let url;
let newWindowEvent;
let newTabEvent;
let updatedNewTabEvent;
let updateMainTabEvent;

const blockedURL = "chrome://";

(async () => {
  await chrome.storage.local.get(["state"], ({ state }) => {
    if (state) {
      startRedirectStopper();
    } else {
      turnOff();
    }
  });
})();

chrome.runtime.onMessage.addListener(({ state }, sender, sendResponse) => {
  if (state) {
    startRedirectStopper();
  } else {
    turnOff();
  }
});

async function startRedirectStopper() {
  await turnOff();
  isOn = true;
  let queryOptions = { active: true, currentWindow: true };
  let tabs = await chrome.tabs.query(queryOptions);
  mainTab = tabs[0];
  url = new URL(mainTab.url).origin;
  if (url.includes(blockedURL)) return await turnOff(true);
  console.log("Main Tab: " + url + " " + mainTab.id);
  newWindowEvent = await chrome.windows.onCreated.addListener(
    async (window) => {
      let checkTabs = await chrome.tabs.query({ id: mainTab.id });
      if (!checkTabs[0]) {
        await chrome.windows.remove(window.id);
      }
    }
  );
  newTabEvent = await chrome.tabs.onCreated.addListener(async (noInfoTab) => {
    if (isOn && (await chrome.tabs.query({ active: false })).length > 0) {
      await chrome.storage.local.get(["state"], async (state) => {
        if (!state)
          await chrome.tabs
            .update(mainTab.id, { active: true })
            .catch((e) => e);
      });
      updatedNewTabEvent = await chrome.tabs.onUpdated.addListener(
        async (_, __, tab) => {
          if (noInfoTab.id === tab.id && noInfoTab.id !== mainTab.id) {
            try {
              if (new URL(tab.url).origin !== url)
                await chrome.tabs.remove(tab.id);
              else await chrome.tabs.update(tab.id, { active: true });
            } catch {
              console.log("Tab Closed.");
            }
          }
        }
      );
    }
  });
}

async function turnOff(localStorage = false) {
  isOn = false;
  await chrome.tabs.onCreated.removeListener(newTabEvent);
  await chrome.tabs.onUpdated.removeListener(updatedNewTabEvent);
  await chrome.windows.onCreated.removeListener(newWindowEvent);
  if (localStorage) {
    await chrome.storage.local.set({ state: false });
  }
}
