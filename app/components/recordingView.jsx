import { useEffect, useRef, useState } from 'react';

export default function RecordingView() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef(null);
  
  const startRecording = () => {
    setIsRecording(true);

    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      const {transcript} = event.results[event.results.length - 1][0];

      setTranscript(transcript);
    }

    recognitionRef.current.start();
    
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [])

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full">
      <div> hi </div>
      {/* Transcript section */}
      
      <div className="w-full">
        {(isRecording || transcript) && (
          <div className="w-1/4 m-auto rounded-md border p-4 bg-white">
            <div className="flex-1 flex w-full justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {recordingComplete ? "Recorded" : "Recording..."}
                </p>
                <p className="text-sm">
                  {recordingComplete ? "Thanks for talking." : "Start speaking."}
                </p>
              </div>
              {isRecording && (
                <div className="rounded-full w-4 h-4 bg-red-400 animate-pulse" />
              )}
            </div>
    
            {transcript && (
              <div className="border rounded-md p-2 mt-4">
                <p className="mb-0">{transcript}</p>
              </div>
            )}
          </div>
        )}


        {/* Button Section */}
        <div className='flex items-center w-full'>
          {isRecording ? (
            <button onClick={handleToggleRecording}
              className='rounded-full w-20 h-20 mt-10 m-auto flex items-center justify-center bg-red-400 hover:bg-red-500'>
                <svg xmlns="http://www.w3.org/2000/svg" className='w-12 h-12' viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.5 4.5h-3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1m10 0h-3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1"/>
                </svg>
            </button>
          ) : (
            <button onClick={handleToggleRecording}
              className='rounded-full w-20 h-20 mt-10 m-auto flex items-center justify-center bg-blue-400 hover:bg-blue-500'>
                <svg xmlns="http://www.w3.org/2000/svg" className='w-12 h-12' viewBox="0 0 21 21">
                  <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m10.39 2.615l.11-.004a2.893 2.893 0 0 1 3 2.891V9.5a3 3 0 1 1-6 0V5.613a3 3 0 0 1 2.89-2.998z"/>
                    <path d="M15.5 9.5a5 5 0 0 1-9.995.217L5.5 9.5m5 5v4"/>
                  </g>
                </svg>
            </button>
          )}
        </div>

      </div>
    </div>
  )
  
  
  
}