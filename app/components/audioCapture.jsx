'use client';

import { useEffect, useRef, useState } from 'react';

const AudioCapture = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const chunks = [];

  useEffect(() => {
    
  }, []);

  const startRecording = async () => {
    // Clear audio chunks before starting a new recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported by your browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = (event) => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);

        // upload to server when recording is stopped
        
        uploadAudio(audioBlob);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
      setIsRecording(false);
    }
  };

  const downloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recording.wav';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const uploadAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
  
    try {
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
  
      if (response.ok) {
        console.log('Audio uploaded successfully');
      } else {
        console.error('Failed to upload audio');
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
    }
  };

  return (
    <div
      className='flex justify-center items-center h-screen bg-slate-900'
    >
      <div>
        {isRecording ? (
          <button
            className='bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2'
            onClick={stopRecording} disabled={!isRecording}>
            Stop Recording
          </button>
        ) : (
          <button
            className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
            onClick={startRecording}>
            Start Recording
          </button>
        )}
        {audioBlob && !isRecording ? (
          <button className='bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2' onClick={downloadAudio}>Download Recording</button>
        ) : (
          <button className='bg-gray-500 text-white font-bold py-2 px-4 rounded ml-2' onClick={downloadAudio} disabled>Download Recording</button>
        )}
      </div>
    </div>
  );
};

export default AudioCapture;
