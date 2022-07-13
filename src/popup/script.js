const toggleBtn = document.querySelector("button");

(async () => {
  await chrome.storage.local.get(["state"], async (result) => {
    console.log(result, " first ");
    if (result.state) await toggleOn();
    else await toggleOff();
  });
})();

toggleBtn.addEventListener("click", async (ele) => {
  await chrome.storage.local.get(["state"], async (result) => {
    if (!result.state) await toggleOn(true);
    else await toggleOff(true);
  });
});

async function toggleOn(sendMsg) {
  toggleBtn.innerText = "On";
  toggleBtn.style.backgroundColor = "rgb(137, 193, 5)";
  const state = true;
  await chrome.storage.local.set({ state: state });
  if (sendMsg) {
    chrome.runtime.sendMessage({ state });
  }
}
async function toggleOff(sendMsg) {
  toggleBtn.innerText = "Off";
  toggleBtn.style.backgroundColor = "rgb(244, 38, 38)";
  const state = false;
  await chrome.storage.local.set({ state: state });
  if (sendMsg) {
    chrome.runtime.sendMessage({ state });
  }
}
