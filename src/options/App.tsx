function App() {

  function classify(text: string) {
    chrome.runtime.sendMessage({ action: "classify", data: { text } });
  }

  return (
    <>
      <h1>Options</h1>
      <button
        onClick={() => {
          classify("Hello, world!");
        }}
      >
        Classify
      </button>
    </>
  );
}

export default App;
