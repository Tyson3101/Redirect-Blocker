// SHORTCUTS LISTENER
let shortCutToggleKeys: string[] = ["alt", "shift", "s"];
let pressedKeys: string[] = [];

document.addEventListener("keydown", async (e) => {
  if (!e.key) return;
  pressedKeys.push(e.key.toLowerCase());
  // Shortcut for toggle application on/off
  if (await checkKeys(shortCutToggleKeys)) {
    chrome.runtime.sendMessage({ toggle: true });
  }
});

chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings;
  if (!settings) return;
  shortCutToggleKeys = settings.shortCut;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const settings = changes.settings.newValue;
    if (!settings) return;
    shortCutToggleKeys = settings.shortCut;
  }
});

function shortCutDebounce(func: Function, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
      pressedKeys = [];
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function checkKeys(keysToCheck: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    function debounceCB() {
      if (!keysToCheck) return resolve(false);
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
    shortCutDebounce(debounceCB, 500)();
  });
}
