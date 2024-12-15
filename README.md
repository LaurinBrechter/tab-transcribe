# TabTranscribe

This is a chrome extensions that automatically transcribes audio from any tab. All of the transcription happens locally on your computer.
No data is send to any servers or third parties.


## Installation

This extension is not officially published on the chrome store. You will have to built it yourself and run it as a development extension. Firstly, install npm, then run `npm run build` which produces a production build of the app. From there, you can load the unpacked extension.

## How it works

When starting the transcription, a new tab opens which captures the tab you want to transcribe. The audio data is gathered there and then 
sent to a background worker that runs the transcription at 20 second time intervals. We use [openai whisper](https://github.com/xenova/whisper-web) for transcription. Because of possible limitations in terms of hardware, whisper tiny was chosen such that the given time frame can be transcribed in the same time or less.

## Limitations

This extension uses the smallest possible version of the openai whisper model. The transcription accuracy may therefore be worse than other transcription solutions. Despite the small size of the model, the transcription process may use substantial system resources.


## Legal Notice

This extension enables audio/video recording and transcription of Chrome browser tabs. By installing and using this extension, you agree to comply with all applicable laws regarding recording and consent in your jurisdiction. You are responsible for obtaining necessary permissions before recording any content, especially in areas requiring two-party consent. This extension should not be used to record copyrighted material, sensitive personal information, or content prohibited by website terms of service. We recommend reviewing relevant privacy laws and platform policies in your region before use. Use of this extension is at your own risk and discretion.