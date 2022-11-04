const toggleBtn = document.querySelector(".toggleBtn") as HTMLButtonElement;
const savedURLS = document.querySelector("#savedURLS") as HTMLTextAreaElement;
const tabExclusiveSelect = document.querySelector(
  "#turnOffOnWhen"
) as HTMLSelectElement;
const nextSettings = document.querySelector("#nextSettings") as HTMLDivElement;

let applicationIsOn: boolean;

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
  const value = savedURLS.value.trim().split("\n");
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
    savedURLS: savedURLS.value.trim().split("\n"),
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
    console.log(nextIndex);
    if (nextIndex >= settingPage.length) return settingPage[0];
    return settingPage[nextIndex];
  })();
  active.classList.remove("active");
  next.classList.add("active");
};

function changeToggleButton(result: boolean) {
  toggleBtn.innerText = result ? "Turn Off" : "Turn On";
  toggleBtn.classList.remove(result ? "off" : "on");
  toggleBtn.classList.add(result ? "on" : "off");
  toggleBtn.classList.remove("loading");
}
