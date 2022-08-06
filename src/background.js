let isOn = false;
let mainTab, newWindowEvent, newTabEvent;

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

chrome.runtime.onMessage.addListener(({ state }) => {
  if (state) {
    startRedirectStopper();
  } else {
    turnOff();
  }
});

async function startRedirectStopper() {
  await turnOff();
  isOn = true;
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  mainTab = tabs[0];
  if (!mainTab?.url) return turnOff(true);
  newWindowEvent = await chrome.windows.onCreated.addListener(
    async (window) => {
      if ((await chrome.tabs.query({})).length > 1) {
        if (mainTab.windowId)
          await chrome.windows
            .update(mainTab.windowId, { active: true })
            .catch((e) => e);
        await chrome.windows.remove(window.id).catch((e) => e);
      }
    }
  );
  newTabEvent = await chrome.tabs.onCreated.addListener(async (tab) => {
    if (isOn && (await chrome.tabs.query({})).length >= 1) {
      await chrome.tabs.update(mainTab.id, { active: true }).catch((e) => e);
      await chrome.tabs.remove(tab.id).catch((e) => e);
    }
  });
}

async function turnOff(localStorage = false) {
  isOn = false;
  await chrome.tabs.onCreated.removeListener(newTabEvent);
  await chrome.windows.onCreated.removeListener(newWindowEvent);
  if (localStorage) {
    await chrome.storage.local.get(["state"], async ({ state }) => {
      if (state) await chrome.storage.local.set({ state: false });
      return;
    });
  }
  return;
}

setInterval(async () => {
  await chrome.storage.local.get(["state"], async (state) => {
    if (!state || (await chrome.tabs.query({})).length <= 0) {
      turnOff();
      state && (await chrome.storage.local.set({ state: false }));
    }
  });
  let checkTab1 = (
    await chrome.tabs.query({ active: true, currentWindow: true })
  )[0];
  if (
    checkTab1 == null ||
    checkTab1?.id == null ||
    mainTab == null ||
    checkTab1.id === mainTab.id
  )
    return;
  return setTimeout(async () => {
    let checkTab2 = (
      await chrome.tabs.query({ active: true, currentWindow: true })
    )[0];
    if (checkTab1?.id === checkTab2?.id) {
      mainTab = checkTab2;
    }
  }, 200);
}, 400);
