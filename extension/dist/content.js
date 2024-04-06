let shortCutToggleSingleKeys = ["alt", "shift", "s"];
let shortCutToggleAllKeys = ["alt", "shift", "a"];
let pressedKeys = [];
chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings;
    if (!settings)
        return;
    shortCutToggleSingleKeys = settings.shortCut;
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
        const settings = changes.settings.newValue;
        if (!settings)
            return;
        shortCutToggleSingleKeys = settings.shortCut;
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
