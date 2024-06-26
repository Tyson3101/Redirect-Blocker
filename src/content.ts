// SHORTCUTS LISTENER
let shortCutToggleSingleKeys: string[] = ["alt", "shift", "s"];
let shortCutToggleAllKeys: string[] = ["alt", "shift", "a"];

let pressedKeys: string[] = [];

chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings;
  if (!settings) return;

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
    if (!settings) return;
    shortCutToggleSingleKeys = settings.shortCutToggleSingleKeys;
    shortCutToggleAllKeys = settings.shortCutToggleAllKeys;
  }
});

shortCutListener();

function shortCutListener() {
  let pressedKeys = [];
  // Web Dev Simplifed Debounce
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
        if (!keysToCheck?.length) return resolve(false);
        if (pressedKeys.length == keysToCheck.length) {
          let match = true;
          for (let i = 0; i < pressedKeys.length; i++) {
            if (pressedKeys[i] != keysToCheck[i]) {
              match = false;
              break;
            }
          }
          resolve(match);
        } else resolve(false);
      }
      if (waitDebounce) debounce(debounceCB, delay)();
      else debounceCB();
    });
  };

  document.addEventListener("keydown", async (e) => {
    if (!e.key) return;
    pressedKeys.push(e.key.toLowerCase());

    // Shortcut for toggle tabs
    if (await checkKeys(shortCutToggleSingleKeys)) {
      chrome.runtime.sendMessage({ toggleSingle: true });
    } else if (await checkKeys(shortCutToggleAllKeys, false)) {
      chrome.runtime.sendMessage({ toggleAll: true });
    }
    pressedKeys = [];
  });
}
