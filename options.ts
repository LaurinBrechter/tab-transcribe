import { WaveFile } from "wavefile";

let audioContext: AudioContext | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let recorderNode: AudioWorkletNode | null = null;
let mediaStream: MediaStream | null = null;

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

function appendAudioData(existingData, newData) {
  // Create a new array with the combined length
  const combinedArray = new Float32Array(existingData.length + newData.length);

  // Copy the existing data
  combinedArray.set(existingData, 0);

  // Copy the new data at the end
  combinedArray.set(newData, existingData.length);

  return combinedArray;
}

async function startRecord() {
  mediaStream = await tabCapture();

  if (mediaStream) {
    audioContext = new AudioContext();
    mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);

    // Create and load the audio worklet
    await audioContext.audioWorklet.addModule("audioProcessor.js");
    recorderNode = new AudioWorkletNode(audioContext, "audio-processor");
    
    let audioDataCache = new Float32Array();
    let lastProcessTime = Date.now();

    recorderNode.port.onmessage = async (event) => {
      const inputData = event.data;
      
      // Create a new WaveFile instance
      let wav = new WaveFile();
      
      // Format the data as a proper WAV file
      wav.fromScratch(1,                    // Number of channels
                      audioContext.sampleRate,    // Sample rate of original audio
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
      if (currentTime - lastProcessTime >= 15000) { // 20000ms = 20 seconds
        const durationInSeconds = audioDataCache.length / 16000;
        console.log(`Audio length: ${durationInSeconds.toFixed(2)} seconds`);
        
        // send audioDataCache to background
        console.log(`sending audioDataCache to background at ${new Date().toLocaleString()}`);
        chrome.runtime.sendMessage({
          action: "AUDIO_DATA",
          data: {
            audioData: audioDataCache,
            fromDate: new Date(Date.now() - 20000).toLocaleString(),
            toDate: new Date().toLocaleString(),
          }
        });

        audioDataCache = new Float32Array();
        lastProcessTime = currentTime; // Reset the timer
      }
    };

    // Connect nodes
    mediaStreamSource.connect(recorderNode);
    recorderNode.connect(audioContext.destination);
    mediaStreamSource.connect(audioContext.destination);
  } else {
    window.close();
  }
}

function stopRecord() {
  if (recorderNode) {
    recorderNode.disconnect();
    recorderNode = null;
  }
  
  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

const stopButton = document.getElementById("stop-record") as HTMLButtonElement;
stopButton?.addEventListener("click", () => {
  stopRecord();
  stopButton.disabled = true;
});


// Receive data from Current Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  console.log(request);

  switch (type) {
    case "START_RECORD":
      console.log("START_RECORD in options.ts", data);
      startRecord();
      break;
    case "STOP_RECORD":
      console.log("STOP_RECORD in options.ts");
      stopRecord();
      break;
    case "TRANSCRIBE_RESULT":
      console.log("TRANSCRIBE_RESULT", data);
      const li = document.createElement("li");
      li.innerHTML = data.fromDate + " - " + data.toDate + ": " + data.text;
      document.getElementById("transcribe-results")?.appendChild(li);
      break;
    default:
      break;
  }

  sendResponse({});
});
