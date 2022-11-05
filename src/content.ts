let applicationIsOn = false;
let tabId: number | undefined;
let shortCutKeys = [];
let removedLinks: { element: HTMLAnchorElement; href: string }[] = [];
const allowedToRedirectURLS = [];

// Keep alive (@wOxxOm stackoverflow https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension)
let port: any;
function connect() {
  port = chrome.runtime.connect({ name: "keepAlive" });
  console.log("connected");
  port.onDisconnect.addListener(connect);
  port.onMessage.addListener((msg: string) => {
    console.log("received", msg, "from bg");
  });
}

function getShortCutKeys() {
  chrome.storage.local.get(["shortCutKeys"], (result) => {
    if (result["shortCutKeys"] == undefined)
      return (shortCutKeys = ["alt", "shift", "s"]);
    shortCutKeys = [...result["shortCutKeys"]];
    shortCutListener();
  });
  chrome.storage.onChanged.addListener((result) => {
    let newShortCutKeys = result["shortCutKeys"]?.newValue;
    if (newShortCutKeys == undefined) return;
    shortCutKeys = [...newShortCutKeys];
  });
}

function addLinks() {
  for (let link of removedLinks) {
    link.element.href = link.href;
  }
}
function removeLinks() {
  const links = document.querySelectorAll("a");
  console.log({ linksLength: links.length });
  removedLinks = [];
  chrome.storage.local.get(["allowedURLS"], ({ allowedURLS }) => {
    if (allowedURLS == undefined) return;
    links.forEach((link) => {
      if (link.href.includes(location.hostname)) return;
      if (link.target == "_blank") return;
      if (
        allowedURLS.some((url: string) =>
          url
            .toLowerCase()
            .replace("www.", "")
            .startsWith(link.href.toLowerCase().replace("www.", ""))
        )
      )
        return;
      removedLinks.push({ element: link, href: link.href });
      link.href = `javascript:void('${link.href} : Change the Prevent URL Change option in settings');`;
    });
  });
}

function setUpRemoveLinksToDifferentSite() {
  chrome.storage.local.get(["preventURLChange"], (result) => {
    if (!applicationIsOn) return console.log("Application is off");
    console.log({ result });
    if (result["preventURLChange"] == "true") {
      removeLinks();
    } else {
      if (removedLinks.length != 0) addLinks();
    }
  });
}

function getTabID() {
  chrome.runtime.sendMessage({ getTabID: true }, () => {
    chrome.runtime.onMessage.addListener(function ({ id, ...request }) {
      console.log(id, request);
      if (tabId !== undefined) {
        if (request.isOn === true) {
          applicationIsOn = true;
          setUpRemoveLinksToDifferentSite();
        } else if (request.isOn === false) {
          applicationIsOn = false;
          if (removedLinks.length != 0) addLinks();
        }
      }
      if (id) tabId = id;
    });
  });
}

chrome.storage.onChanged.addListener((result) => {
  if (result["preventURLChange"]?.newValue != undefined) {
    setUpRemoveLinksToDifferentSite();
  }
});

connect();
getShortCutKeys();
getTabID();

function shortCutListener() {
  let pressedKeys = [];
  console.log("Function called.", shortCutKeys);
  // Web Dev Simplifed Debounce
  function debounce(cb: Function, delay = 200) {
    let timeout: number;

    return (...args: any) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        cb(...args);
      }, delay);
    };
  }

  const checkKeys = debounce(() => {
    console.log("Running checkKeys");
    // Github co pilot
    if (pressedKeys.length == shortCutKeys.length) {
      let match = true;
      for (let i = 0; i < pressedKeys.length; i++) {
        if (pressedKeys[i] != shortCutKeys[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        chrome.runtime.sendMessage({ shortCut: true });
      }
    }
    pressedKeys = [];
  });

  document.addEventListener("keydown", (e) => {
    console.log("Keydown");
    pressedKeys.push(e.key.toLowerCase());
    checkKeys();
  });
}
