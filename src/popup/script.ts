const toggleBtn = document.querySelector(".toggleBtn") as HTMLButtonElement;
const savedURLS = document.querySelector("#savedURLS") as HTMLTextAreaElement;
const allowedURLS = document.querySelector(
  "#allowedURLS"
) as HTMLTextAreaElement;
const tabExclusiveSelect = document.querySelector(
  "#turnOffOnWhen"
) as HTMLSelectElement;
const preventURLSelect = document.querySelector(
  "#preventURLChange"
) as HTMLSelectElement;
const shortCutInput = document.querySelector(
  "#shortCutInput"
) as HTMLInputElement;
const nextSettings = document.querySelector("#nextSettings") as HTMLDivElement;
const backSettings = document.querySelector("#backSettings") as HTMLDivElement;
const pageNumber = document.querySelector("#pageNumber") as HTMLDivElement;

chrome.storage.local.get("savedURLS", (result) => {
  let value = result["savedURLS"];
  if (value == undefined) {
    chrome.storage.local.set({
      savedURLS: ["https://soap2day.day/"],
    });
    value = ["https://soap2day.day/"];
  }
  savedURLS.value = value.join("\n");
});

savedURLS.addEventListener("input", () => {
  const value = savedURLS.value.toLowerCase().trim().split("\n");
  if (
    value.some(
      (url) =>
        !url.match(
          /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi
        )
    )
  )
    return;
  chrome.storage.local.set({
    savedURLS: savedURLS.value.toLowerCase().trim().split("\n"),
  });
});

chrome.storage.local.get("allowedURLS", (result) => {
  let value = result["allowedURLS"];
  if (value == undefined) {
    chrome.storage.local.set({
      allowedURLS: ["https://youtube.com/@Tyson3101"],
    });
    value = ["https://youtube.com/@Tyson3101"];
  }
  allowedURLS.value = value.join("\n");
});

allowedURLS.addEventListener("input", () => {
  const value = allowedURLS.value.toLowerCase().trim().split("\n");
  if (
    value.some(
      (url) =>
        !url.match(
          /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi
        )
    )
  )
    return;
  console.log(value);
  chrome.storage.local.set({
    allowedURLS: value,
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tab = tabs[0];
  chrome.storage.onChanged.addListener((result) => {
    let value = result["applicationIsOn" + tab.id]?.newValue;
    if (value == undefined) return;
    changeToggleButton(value);
    applicationIsOn = value;
  });

  chrome.storage.local.get(["applicationIsOn" + tab.id], (result) => {
    let value = result["applicationIsOn" + tab.id];
    if (value == undefined) value = false;
    changeToggleButton(result["applicationIsOn" + tab.id]);
    applicationIsOn = result["applicationIsOn" + tab.id];
  });
});

chrome.storage.local.get(["tabExclusive"], async ({ tabExclusive }) => {
  if (tabExclusive == undefined) {
    await chrome.storage.local.set({ tabExclusive: "tab" });
    return (tabExclusiveSelect.value = "tab");
  }
  tabExclusiveSelect.value = tabExclusive === "tab" ? "url" : "tab";
});

tabExclusiveSelect.addEventListener("change", (e) => {
  chrome.storage.local.set({
    tabExclusive: tabExclusiveSelect.value === "tab" ? "url" : "tab",
  });
});
chrome.storage.local.get(["preventURLChange"], async ({ preventURLChange }) => {
  if (preventURLChange == undefined) {
    await chrome.storage.local.set({ preventURLChange: "false" });
    return (preventURLSelect.value = "false");
  }
  preventURLSelect.value = preventURLChange;
});

preventURLSelect.addEventListener("change", (e) => {
  chrome.storage.local.set({
    preventURLChange: (e.target as HTMLSelectElement).value,
  });
});

chrome.storage.local.get(["shortCutKeys"], async ({ shortCutKeys }) => {
  if (shortCutKeys == undefined) {
    await chrome.storage.local.set({ shortCutKeys: ["alt", "shift", "s"] });
    return (shortCutInput.value = "alt+shift+s");
  }
  shortCutInput.value = shortCutKeys.join("+");
  shortCutInput.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value.trim().split("+");
    if (!value.length) return;
    chrome.storage.local.set({
      shortCutKeys: value,
    });
    shortCutInput.value = value.join("+");
  });
});

document.onclick = (e: Event) => {
  if (
    (e.target as HTMLButtonElement).classList.contains("toggleBtn") &&
    applicationIsOn !== null
  ) {
    applicationIsOn = !applicationIsOn;
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      chrome.storage.local.set({
        ["applicationIsOn" + tabs[0].id]: applicationIsOn,
      });
      chrome.runtime.sendMessage({
        isOn: applicationIsOn,
        tabId: tabs[0].id,
        windowId: tabs[0].windowId,
        tabExclusive: tabExclusiveSelect.value,
        lastURL: tabs[0].url,
      });
    });
  }
  if ((e.target as HTMLButtonElement).id === "shortCutBtn")
    document.querySelector(".shortCut").classList.toggle("remove");
};

nextSettings.onclick = () => {
  const settingPage = document.querySelectorAll(
    ".settingsPage"
  ) as NodeListOf<HTMLDivElement>;
  const active = [...settingPage].find((page) =>
    page.classList.contains("active")
  );
  const next = (() => {
    const nextIndex = parseInt(active.dataset["settingindex"]) + 1;
    if (nextIndex >= settingPage.length) return settingPage[0];
    return settingPage[nextIndex];
  })();
  pageNumber.innerText = `${parseInt(next.dataset["settingindex"]) + 1}/5`;
  active.classList.remove("active");
  next.classList.add("active");
};

backSettings.onclick = () => {
  const settingPage = document.querySelectorAll(
    ".settingsPage"
  ) as NodeListOf<HTMLDivElement>;
  const active = [...settingPage].find((page) =>
    page.classList.contains("active")
  );
  const last = (() => {
    const lastIndex = parseInt(active.dataset["settingindex"]) - 1;
    if (lastIndex < 0) {
      pageNumber.innerText = `5/5`;
      return settingPage[4];
    } else {
      pageNumber.innerText = `${parseInt(active.dataset["settingindex"])}/5`;
      return settingPage[lastIndex];
    }
  })();
  active.classList.remove("active");
  last.classList.add("active");
};

function changeToggleButton(result: boolean) {
  toggleBtn.innerText = result ? "Turn Off" : "Turn On";
  toggleBtn.classList.remove(result ? "off" : "on");
  toggleBtn.classList.add(result ? "on" : "off");
  toggleBtn.classList.remove("loading");
}
