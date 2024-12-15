import { WaveFile } from "wavefile";

console.log("options.js loaded");

function tabCapture() {
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

function to16BitPCM(input) {
  const dataLength = input.length * (16 / 8);
  const dataBuffer = new ArrayBuffer(dataLength);
  const dataView = new DataView(dataBuffer);
  let offset = 0;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return dataView;
}

function to16kHz(audioData, sampleRate = 44100) {
  const data = new Float32Array(audioData);
  const fitCount = Math.round(data.length * (16000 / sampleRate));
  const newData = new Float32Array(fitCount);
  const springFactor = (data.length - 1) / (fitCount - 1);
  newData[0] = data[0];
  for (let i = 1; i < fitCount - 1; i++) {
    const tmp = i * springFactor;
    const before = Math.floor(tmp).toFixed();
    const after = Math.ceil(tmp).toFixed();
    const atPoint = tmp - before;
    newData[i] = data[before] + (data[after] - data[before]) * atPoint;
  }
  newData[fitCount - 1] = data[data.length - 1];
  return newData;
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
  const combinedArray = new Int16Array(existingData.length + newData.length);

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
    // call when the stream inactive
    stream.oninactive = () => {
      window.close();
    };

    let audioDataCache = new Int16Array();
    const context = new AudioContext();
    const mediaStream = context.createMediaStreamSource(stream);

    // Create and load the audio worklet
    await context.audioWorklet.addModule("audioProcessor.js");
    const recorder = new AudioWorkletNode(context, "audio-processor");


    let lastProcessTime = Date.now();

    recorder.port.onmessage = async (event) => {
      const inputData = event.data;
      const output = to16kHz(inputData, context.sampleRate);
      const audioData = to16BitPCM(output);
      const newAudioData = new Int16Array(audioData.buffer);

      // Append new data to cache
      audioDataCache = appendAudioData(audioDataCache, newAudioData);

      const currentTime = Date.now();
      if (currentTime - lastProcessTime >= 5000) {
        // 5000ms = 5 seconds
        console.log("audioDataCache", audioDataCache);

        // Create an AudioBuffer (mono channel, 16kHz sample rate)
        const audioBuffer = context.createBuffer(
          1,
          audioDataCache.length,
          16000
        );
        const channelData = audioBuffer.getChannelData(0);

        // Convert Int16Array to Float32Array (normalized between -1 and 1)
        for (let i = 0; i < audioDataCache.length; i++) {
          channelData[i] = audioDataCache[i] / 32768.0; // Divide by 2^15 to normalize
        }


        audioDataCache = new Int16Array();
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
    default:
      break;
  }

  sendResponse({});
});
