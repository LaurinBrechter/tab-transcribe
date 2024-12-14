import { useState } from "react";
import "./App.css";

function App() {
  const startRecording = async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(tab);
    chrome.runtime.sendMessage({ action: "startRecording" });
  };
  const stopRecording = async () => {
    chrome.runtime.sendMessage({ action: "stopRecording" });
  };
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);

  return (
    <>
      <h1>Tab Capture</h1>
      <div className="card">
        <button onClick={startRecording}>Start Transcribing Current Tab</button>
        <button onClick={stopRecording}>Stop Transcribing Current Tab</button>
        {tab && <p>{tab.url}</p>}
      </div>
    </>
  );
}

export default App;
