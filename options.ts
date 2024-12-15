import { WaveFile } from "wavefile";

console.log("options.js loaded");

function tabCapture(): Promise<MediaStream | null> {
  return new Promise((resolve) => {
    chrome.tabCapture.capture(
      {
        audio: true,
        video: false,
      },
      (stream) => {
        resolve(stream);
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

function appendAudioData(existingData, newData) {
  // Create a new array with the combined length
  const combinedArray = new Float32Array(existingData.length + newData.length);

  // Copy the existing data
  combinedArray.set(existingData, 0);

  // Copy the new data at the end
  combinedArray.set(newData, existingData.length);

  return combinedArray;
}

async function startRecord(option) {
  const stream = await tabCapture();

  console.log(stream);

  if (stream) {
    let audioDataCache = new Float32Array();
    const context = new AudioContext();
    const mediaStream = context.createMediaStreamSource(stream);

    // Create and load the audio worklet
    await context.audioWorklet.addModule("audioProcessor.js");
    const recorder = new AudioWorkletNode(context, "audio-processor");

    let lastProcessTime = Date.now();

    recorder.port.onmessage = async (event) => {
      const inputData = event.data;
      
      // Create a new WaveFile instance
      let wav = new WaveFile();
      
      // Format the data as a proper WAV file
      wav.fromScratch(1,                    // Number of channels
                      context.sampleRate,    // Sample rate of original audio
                      '32f',                // Bit depth
                      inputData);           // Audio data
      
      // Convert to desired format
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);
      let audioData = wav.getSamples();

      // Handle multi-channel audio
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);

          // Merge channels (into first channel to save memory)
          for (let i = 0; i < audioData[0].length; ++i) {
            audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
          }
        }

        // Select first channel
        audioData = audioData[0];
      }

      // Append new data to cache
      audioDataCache = appendAudioData(audioDataCache, audioData);

      const currentTime = Date.now();
      if (currentTime - lastProcessTime >= 20000) { // 20000ms = 20 seconds
        const durationInSeconds = audioDataCache.length / 16000;
        console.log(`Audio length: ${durationInSeconds.toFixed(2)} seconds`);
        
        // send audioDataCache to background
        console.log(`sending audioDataCache to background at ${new Date().toLocaleString()}`);
        chrome.runtime.sendMessage({
          action: "AUDIO_DATA",
          data: audioDataCache,
        });

        audioDataCache = new Float32Array();
        lastProcessTime = currentTime; // Reset the timer
      }
    };

    // Connect nodes
    mediaStream.connect(recorder);
    recorder.connect(context.destination);
    mediaStream.connect(context.destination);
  } else {
    window.close();
  }
}

// Receive data from Current Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  console.log(request);

  switch (type) {
    case "START_RECORD":
      startRecord(data);
      break;
    case "TRANSCRIBE_RESULT":
      console.log("TRANSCRIBE_RESULT", data);
      const div = document.createElement("div");
      div.innerHTML = JSON.stringify(data);
      document.getElementById("transcribe-results")?.appendChild(div);
      break;
    default:
      break;
  }

  sendResponse({});
});
