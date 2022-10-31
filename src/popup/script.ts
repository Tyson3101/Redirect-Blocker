const toggleBtn = document.querySelector(".toggleBtn") as HTMLButtonElement;
let applicationIsOn: boolean;

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tab = tabs[0];
  chrome.storage.onChanged.addListener((result) => {
    let value = result["applicationIsOn" + tab.id]?.newValue;
    if (value == undefined) value = false;
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
      });
    });
  }
  if ((e.target as HTMLButtonElement).id === "shortCutBtn")
    document.querySelector(".shortCut").classList.toggle("remove");
};

function changeToggleButton(result: boolean) {
  toggleBtn.innerText = result ? "Turn Off" : "Turn On";
  toggleBtn.classList.remove(result ? "off" : "on");
  toggleBtn.classList.add(result ? "on" : "off");
}
