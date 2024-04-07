const toggleBtn = document.querySelector(".toggleBtn") as HTMLButtonElement;

const currentTabExtMode = document.querySelector(
  ".currentTabExtMode"
) as HTMLSpanElement;
const allTabsExtMode = document.querySelector(
  ".allTabsExtMode"
) as HTMLSpanElement;

const savedURLsInput = document.querySelector(
  "#savedURLs"
) as HTMLTextAreaElement;
const allowedURLsInput = document.querySelector(
  "#allowedURLS"
) as HTMLTextAreaElement;
const tabExclusiveSelect = document.querySelector(
  "#turnOffOnWhen"
) as HTMLSelectElement;
const preventURLSelect = document.querySelector(
  "#preventURLChange"
) as HTMLSelectElement;
const shortCutSingleInput = document.querySelector(
  "#shortCutSingleInput"
) as HTMLInputElement;
const shortCutAllInput = document.querySelector(
  "#shortCutAllInput"
) as HTMLInputElement;

const shortCutBtn = document.querySelector("#shortCutBtn") as HTMLSpanElement;
const shortCutSingleDisplay = document.querySelector(
  "#shortCutSingleDisplay"
) as HTMLSpanElement;
const shortCutAllDisplay = document.querySelector(
  "#shortCutAllDisplay"
) as HTMLSpanElement;

const nextSettings = document.querySelector("#nextSettings") as HTMLDivElement;
const backSettings = document.querySelector("#backSettings") as HTMLDivElement;
const pageNumber = document.querySelector("#pageNumber") as HTMLDivElement;
const pageList = document.querySelector(".pageList") as HTMLDivElement;

const placeholderSettings = {
  tabExclusive: false,
  preventURLChange: false,
  savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
  allowedURLs: ["https://youtube.com/@Tyson3101"],
  shortCutToggleSingleKeys: ["alt", "shift", "s"],
  shortCutToggleAllKeys: ["alt", "shift", "a"],
};

let extensionModePopUp = "single";
let allTabsModeIsOn_POPUP = false;
let currentTabIsOn_POPUP = false;

chrome.storage.local.set({ extensionModePopUp: "single" }).catch(() => {});

chrome.storage.local.get("extensionTabs", async ({ extensionTabs }) => {
  if (!extensionTabs) extensionTabs = [];

  const activeTab = (
    await chrome.tabs
      .query({ active: true, currentWindow: true })
      .catch(() => null)
  )?.[0];
  if (!activeTab) return;
  const extTab = extensionTabs.find((tab) => tab.id === activeTab.id);
  if (extTab) {
    changeToggleButton(true);
    currentTabIsOn_POPUP = true;
  } else {
    changeToggleButton(false);
  }
});

chrome.storage.local.get("allTabsModeIsOn", ({ allTabsModeIsOn }) => {
  if (allTabsModeIsOn) {
    allTabsModeIsOn_POPUP = true;
  }
});

toggleBtn.onclick = async () => {
  const activeTab = (
    await chrome.tabs
      .query({ active: true, currentWindow: true })
      .catch(() => null)
  )?.[0];
  if (!activeTab) return;
  chrome.storage.local.get(["extensionTabs"], async ({ extensionTabs }) => {
    if (!extensionTabs) extensionTabs = [];

    if (extensionModePopUp === "single") {
      const extTab = extensionTabs.find((tab) => tab.id === activeTab.id);
      if (extTab) {
        extensionTabs = extensionTabs.filter((tab) => tab.id !== activeTab.id);
        currentTabIsOn_POPUP = false;
      } else {
        extensionTabs.push(activeTab);
        currentTabIsOn_POPUP = true;
      }
      chrome.storage.local.set({ extensionTabs });
      changeToggleButton(currentTabIsOn_POPUP);
    } else {
      if (allTabsModeIsOn_POPUP) {
        extensionTabs = [];
        allTabsModeIsOn_POPUP = false;
        currentTabIsOn_POPUP = false;
        changeToggleButton(false);
        chrome.storage.local.set({ extensionTabs, allTabsModeIsOn: false });
      } else {
        const tabs = await chrome.tabs.query({}).catch(() => []);
        extensionTabs = tabs;
        allTabsModeIsOn_POPUP = true;
        currentTabIsOn_POPUP = true;
        changeToggleButton(true);
        chrome.storage.local.set({ extensionTabs, allTabsModeIsOn: true });
      }
    }
  });
};

currentTabExtMode.onclick = () => {
  chrome.storage.local.set({ extensionModePopUp: "single" });
  changeExtensionMode("single");
};

allTabsExtMode.onclick = () => {
  chrome.storage.local.set({ extensionModePopUp: "all" });
  changeExtensionMode("all");
};

shortCutBtn.onclick = () => {
  document.querySelector(".shortCut").classList.toggle("remove");
};

function changeExtensionMode(result: "single" | "all") {
  currentTabExtMode.classList.remove("selected");
  allTabsExtMode.classList.remove("selected");
  if (result === "single") {
    extensionModePopUp = "single";
    currentTabExtMode.classList.add("selected");

    document
      .querySelector(".shortCutSingleContainer")
      .classList.remove("hideShortCut");
    document
      .querySelector(".shortCutAllContainer")
      .classList.add("hideShortCut");

    if (currentTabIsOn_POPUP) {
      changeToggleButton(true);
    } else {
      changeToggleButton(false);
    }
  } else {
    extensionModePopUp = "all";
    allTabsExtMode.classList.add("selected");

    document
      .querySelector(".shortCutSingleContainer")
      .classList.add("hideShortCut");
    document
      .querySelector(".shortCutAllContainer")
      .classList.remove("hideShortCut");

    if (allTabsModeIsOn_POPUP) {
      changeToggleButton(true);
    } else {
      changeToggleButton(false);
    }
  }
}

chrome.storage.sync.get("settings", (result) => {
  if (!result.settings) {
    result.settings = placeholderSettings;
  }
  updateSettingsUI(result.settings);
  handleSettingsChange();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.settings) return;
  updateSettingsUI(changes.settings.newValue);
});

function updateSettingsUI(settings: typeof placeholderSettings) {
  if (!settings) settings = placeholderSettings;
  savedURLsInput.value = settings.savedURLs.join("\n");
  allowedURLsInput.value = settings.allowedURLs.join("\n");
  tabExclusiveSelect.value = settings.tabExclusive ? "tab" : "url";
  preventURLSelect.value = settings.preventURLChange ? "true" : "false";

  shortCutSingleInput.value = settings.shortCutToggleSingleKeys.join(" + ");
  shortCutAllInput.value = settings.shortCutToggleAllKeys.join(" + ");

  shortCutSingleDisplay.innerText =
    settings.shortCutToggleSingleKeys.join(" + ");
  shortCutAllDisplay.innerText = settings.shortCutToggleAllKeys.join(" + ");
}

function handleSettingsChange() {
  savedURLsInput.onchange = () => {
    const savedURLs = savedURLsInput.value
      .trim()
      .split("\n")
      .filter(isValidURL);
    saveSettings("savedURLs", savedURLs);
  };
  allowedURLsInput.onchange = () => {
    const allowedURLs = allowedURLsInput.value
      .trim()
      .split("\n")
      .filter(isValidURL);
    saveSettings("allowedURLs", allowedURLs);
  };
  tabExclusiveSelect.onchange = () => {
    const tabExclusive = tabExclusiveSelect.value === "tab";
    saveSettings("tabExclusive", tabExclusive);
  };
  preventURLSelect.onchange = () => {
    const preventURLChange = preventURLSelect.value === "true";
    saveSettings("preventURLChange", preventURLChange);
  };
  shortCutSingleInput.onchange = () => {
    const shortCut = shortCutSingleInput.value
      .trim()
      .split("+")
      .map((s) => s.trim().toLowerCase());

    saveSettings("shortCutToggleSingleKeys", shortCut);
  };
  shortCutAllInput.onchange = () => {
    const shortCut = shortCutAllInput.value
      .trim()
      .split("+")
      .map((s) => s.trim().toLowerCase());

    saveSettings("shortCutToggleAllKeys", shortCut);
  };

  function saveSettings(setting: string, value: any) {
    chrome.storage.sync.get("settings", (result) => {
      const settings = result.settings;
      chrome.storage.sync.set({
        settings: { ...settings, [setting]: value },
      });
    });
  }

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

    pageList.querySelector(".active").classList.remove("active");
    pageList.children[parseInt(next.dataset["settingindex"])].classList.add(
      "active"
    );
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

    pageList.querySelector(".active").classList.remove("active");
    pageList.children[parseInt(last.dataset["settingindex"])].classList.add(
      "active"
    );
  };
}

pageList.onclick = (e) => {
  const ele = e.target as HTMLDivElement;
  if (ele?.tagName?.toLowerCase() == "a") {
    const settingPage = document.querySelectorAll(
      ".settingsPage"
    ) as NodeListOf<HTMLDivElement>;
    const activePage = [...settingPage].find((page) =>
      page.classList.contains("active")
    );
    const nextPage = settingPage[parseInt(ele.dataset["pageindex"])];
    pageNumber.innerText = `${
      parseInt(nextPage.dataset["settingindex"]) + 1
    }/5`;

    activePage.classList.remove("active");
    nextPage.classList.add("active");

    pageList.querySelector(".active").classList.remove("active");
    ele.classList.add("active");
  }
};

function changeToggleButton(result: boolean) {
  toggleBtn.innerText = result ? "Turn Off" : "Turn On";
  toggleBtn.classList.remove(result ? "off" : "on");
  toggleBtn.classList.add(result ? "on" : "off");
  toggleBtn.classList.remove("loading");
}

function isValidURL(url: string) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}
