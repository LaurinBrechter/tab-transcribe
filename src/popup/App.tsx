import { useState } from "react";
import "./App.css";

function App() {
  const startRecording = async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(tab);
    chrome.runtime.sendMessage({ action: "startRecording" });
  };
  const stopRecording = async () => {
    chrome.runtime.sendMessage({ action: "STOP_RECORD" });
  };
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);

  return (
    <>
      <h1>Tab Transcribe</h1>
      <div className="card">
        <button onClick={startRecording}>Start Transcribing Current Tab</button>
        <button onClick={stopRecording}>Stop Transcribing Current Tab</button>
      </div>
      {tab && <p>{tab.url}</p>}
    </>
  );
}

export default App;
