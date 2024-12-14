let activeStream = null;
let mediaRecorder = null;

function openOptions() {
  return new Promise(async (resolve) => {
    chrome.tabs.create(
      {
        pinned: true,
        active: false, // <--- Important
        url: `chrome-extension://${chrome.runtime.id}/options.html`,
      },
      (tab) => {
        resolve(tab);
      }
    );
  });
}

function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId).then(resolve).catch(resolve);
  });
}

function executeScript(tabId, file) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: [file],
      },
      () => {
        resolve();
      }
    );
  });
}

function insertCSS(tabId, file) {
  return new Promise((resolve) => {
    chrome.scripting.insertCSS(
      {
        target: { tabId },
        files: [file],
      },
      () => {
        resolve();
      }
    );
  });
}

function sendMessageToTab(tabId, data) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, data, (res) => {
      resolve(res);
    });
  });
}

function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

function setStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [key]: value,
      },
      () => {
        resolve(value);
      }
    );
  });
}

function stopCapture() {
  console.log("Stop Capture");
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

// https://github.com/apsislabs/chrome_extension_starter

// Instead of using onClicked, you can message from your popup to the background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "stopRecording") {
    console.log("Stop Recording");
    stopCapture();
    const optionTabId = await getStorage("optionTabId");
    if (optionTabId) {
      await removeTab(optionTabId);
    }
  }
  if (message.action === "startRecording") {
    const currentTab = await chrome.tabs.query({active: true, currentWindow: true}).then(tabs => tabs[0]);
    console.log("Current Tab", currentTab);

    // Is it record only one tab at the same time?
    const optionTabId = await getStorage("optionTabId");
    if (optionTabId) {
      await removeTab(optionTabId);
    }

    console.log("Current Tab", currentTab);

    // Whether there has audio on the current tab ?
    if (currentTab.audible) {
      // You can save the current tab id to cache
      await setStorage("currentTabId", currentTab.id);

      // You can inject code to the current page
      // await executeScript(currentTab.id, "content.js");
      // await insertCSS(currentTab.id, "content.css");

      await sleep(500);

      // Open the option tab
      const optionTab = await openOptions();
      console.log("Option tab", optionTab);

      // You can save the option tab id to cache
      await setStorage("optionTabId", optionTab.id);

      await sleep(500);

      // You can pass some data to option tab
      await sendMessageToTab(optionTab.id, {
        type: "START_RECORD",
        data: { currentTabId: currentTab.id },
      });
    } else {
      console.log("No Audio");
    }
  }
});

// chrome.tabs.onRemoved.addListener(async (tabId) => {
//   const currentTabId = await getStorage("currentTabId");
//   const optionTabId = await getStorage("optionTabId");

//   // When the current tab is closed
//   if (currentTabId === tabId) {
//     stopCapture();
//     if (optionTabId) {
//       await removeTab(optionTabId);
//     }
//   }
  
//   // When the options tab is closed
//   if (optionTabId === tabId) {
//     stopCapture();
//     // Clear the stored optionTabId since it's no longer valid
//     await setStorage("optionTabId", null);
//     // Optionally clear the currentTabId as well if you want to reset the recording state completely
//     await setStorage("currentTabId", null);
//   }
// });
