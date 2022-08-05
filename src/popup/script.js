const toggleBtn = document.querySelector("button");

(async () => {
  await chrome.storage.local.get(["state"], async (result) => {
    if (result.state) await toggleOn();
    else await toggleOff();
  });
})();

toggleBtn.addEventListener("click", async () => {
  await chrome.storage.local.get(["state"], async (result) => {
    if (!result.state) await toggleOn();
    else await toggleOff();
  });
});

async function toggleOn() {
  toggleBtn.innerText = "On";
  toggleBtn.style.backgroundColor = "rgb(137, 193, 5)";
  const state = true;
  await chrome.storage.local.set({ state: state });
  chrome.runtime.sendMessage({ state });
}
async function toggleOff() {
  toggleBtn.innerText = "Off";
  toggleBtn.style.backgroundColor = "rgb(244, 38, 38)";
  const state = false;
  await chrome.storage.local.set({ state: state });
  chrome.runtime.sendMessage({ state });
}
