let isOn = false;
let mainTab, url, newWindowEvent, newTabEvent, updatedNewTabEvent;

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
  let queryOptions = { active: true, currentWindow: true };
  let tabs = await chrome.tabs.query(queryOptions);
  mainTab = tabs[0];
  url = new URL(mainTab.url).origin;
  if (!url || !mainTab) return await turnOff(true);
  newWindowEvent = await chrome.windows.onCreated.addListener(
    async (window) => {
      if ((await chrome.tabs.query({})).length > 1) {
        await chrome.windows.remove(window.id);
      }
    }
  );
  newTabEvent = await chrome.tabs.onCreated.addListener(async (noInfoTab) => {
    if (isOn && (await chrome.tabs.query({})).length >= 1) {
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
              if (
                new URL(tab.url).origin !== url ||
                new URL(tab.url).origin.includes(blockedURL)
              )
                await chrome.tabs.remove(tab.id);
              else await chrome.tabs.update(tab.id, { active: true });
            } catch {}
          }
          await chrome.tabs.onUpdated.removeListener(updatedNewTabEvent);
        }
      );
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
  if ((await chrome.tabs.query({})).length <= 0) {
    turnOff(true);
  }
  return;
}, 200);
