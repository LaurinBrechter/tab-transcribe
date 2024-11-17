// const WaveFile = require('wavefile');
import { WaveFile } from 'wavefile';

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
    
    console.log(mediaStream);

    // Create and load the audio worklet
    await context.audioWorklet.addModule('audioProcessor.js');
    const recorder = new AudioWorkletNode(context, 'audio-processor');
    
    console.log(recorder);

    recorder.port.onmessage = async (event) => {
      const inputData = event.data;
      const output = to16kHz(inputData, context.sampleRate);
      const audioData = to16BitPCM(output);
      console.log('audioData', new Int16Array(audioData.buffer));

      const newAudioData = new Int16Array(audioData.buffer);
      console.log('newAudioData', newAudioData.slice(0, 10)); // Debug the incoming data

      // Create a new array with combined length
      const combinedArray = new Int16Array(audioDataCache.length + newAudioData.length);
      combinedArray.set(audioDataCache); // Copy existing cache
      combinedArray.set(newAudioData, audioDataCache.length); // Append new data
      console.log('combinedArray', combinedArray.slice(0, 10));
      audioDataCache = combinedArray; // Replace cache with combined array

      if (audioDataCache.length > 1280) {
        console.log('audioDataCache', audioDataCache);
        const wav = new WaveFile();
        wav.fromScratch(1, 16000, "16", audioDataCache);
        const wavBlob = new Blob([wav.toBuffer()], { type: "audio/wav" });
          
        const formData = new FormData();
        formData.append("file", wavBlob, "audio.wav");
        formData.append("model", "whisper-1"); // Specify the model you want to use

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
          }
        );

        const result = await response.json();
        console.log(result);

        // You can pass some data to current tab
        await sendMessageToTab(option.currentTabId, {
          type: "FROM_OPTION",
          data: audioDataCache.length,
        });

        audioDataCache.length = 0;
        
        // Remove the message listener after first execution
        recorder.port.onmessage = null;
      }
    };

    // Connect nodes
    mediaStream.connect(recorder);
    recorder.connect(context.destination);
    mediaStream.connect(context.destination);
    
    // Cancel after 5 seconds
    setTimeout(() => {
      mediaStream.disconnect();
      recorder.disconnect();
    }, 5000);
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