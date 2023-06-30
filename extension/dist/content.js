let shortCutToggleKeys = ["alt", "shift", "s"];
let pressedKeys = [];
document.addEventListener("keydown", async (e) => {
    if (!e.key)
        return;
    pressedKeys.push(e.key.toLowerCase());
    if (await checkKeys(shortCutToggleKeys)) {
        chrome.runtime.sendMessage({ toggle: true });
    }
});
chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings;
    if (!settings)
        return;
    shortCutToggleKeys = settings.shortCut;
    console.log("Settings loaded", shortCutToggleKeys);
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
        const settings = changes.settings.newValue;
        if (!settings)
            return;
        shortCutToggleKeys = settings.shortCut;
    }
});
function shortCutDebounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
            pressedKeys = [];
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
function checkKeys(keysToCheck) {
    return new Promise((resolve) => {
        function debounceCB() {
            if (!keysToCheck)
                return resolve(false);
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
        shortCutDebounce(debounceCB, 500)();
    });
}
