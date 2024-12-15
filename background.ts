let mediaRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;


// background.js - Handles requests from the UI, runs the model, then sends back a response

import { pipeline, env } from '@xenova/transformers';

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;


class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback, quantized:false });
        }

        return this.instance;
    }
}

let model: any = null;

// Initialize model in an async function
async function initModel() {
    model = await PipelineSingleton.getInstance((data) => {
        // You can track the progress of the pipeline creation here.
        // e.g., you can send `data` back to the UI to indicate a progress bar
        console.log('progress', data)
    });
}

// Call the initialization function
initModel().catch(console.error);

const transcribe = async (audioData:Float32Array) => {
  // Get the pipeline instance. This will load and build the model when run for the first time.
  const startTime = new Date().getTime();
  
  const endTime = new Date().getTime();
  console.log(`pipeline created at ${new Date().toLocaleString()}, time taken: ${endTime - startTime}ms`);

  // Actually run the model on the input text
  let result: {text: string} = await model(audioData);
  return result;
};



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

  if (message.action === "AUDIO_DATA") {
    // Convert object to Float32Array
    const audioArray = new Float32Array(Object.values(message.data.audioData));
    const startTime = new Date().getTime();
    console.log(`receiving audio data at ${new Date().toLocaleString()}, starting transcription`);
    const result = await transcribe(audioArray);
    result.fromDate = message.data.fromDate;
    result.toDate = message.data.toDate;
    const endTime = new Date().getTime();
    console.log(`finished transcription at ${new Date().toLocaleString()}, time taken: ${endTime - startTime}ms`);
    console.log("Transcribe Result", result);

    chrome.runtime.sendMessage({
      type: "TRANSCRIBE_RESULT",
      data: result
    });

  }
  
  // if (message.action === "stopRecording") {
  //   console.log("Stop Recording");
  //   stopCapture();
  //   const optionTabId = await getStorage("optionTabId");
  //   if (optionTabId) {
  //     await removeTab(optionTabId);
  //   }
  // }
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
