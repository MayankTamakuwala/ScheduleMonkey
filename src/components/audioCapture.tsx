'use client';

import { useEffect, useRef, useState } from 'react';

const AudioCapture = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioStream, setAudioStream] = useState<MediaStream | null >(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const chunks: any = [];
    const [socket, setSocket] = useState<WebSocket | null>(null);
    
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

            const socket = new WebSocket('ws://localhost:8000/stream-audio');
            
            socket.onopen = () => {
                console.log('WebSocket connection opened');
                const recorder = new MediaRecorder(stream);
                recorder.ondataavailable = (event) => {
                    if (event.data?.size > 0) {
                        chunks.push(event.data);
                        // send audio chunks to server
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            socket.send(event.data);
                        }
                    }
                };

                recorder.onstop = (event) => {
                    console.log('Recording stopped');
                    const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setAudioBlob(audioBlob);

                    // Wait for all pending chunks to be sent before closing
                    const interval = setInterval(() => {
                        if (socket?.readyState === WebSocket.OPEN) {
                            console.log('Closing WebSocket connection');
                            socket.close();
                            clearInterval(interval);  // Stop the interval
                        }
                    }, 100);  // Check every 100ms if all chunks are sent

                    // upload to server when recording is stopped
                    // uploadAudio(audioBlob);
                };

                recorder.start(100);// Adjust the interval to send data more frequently
                // recorder.start();
                setMediaRecorder(recorder);
            };

            setIsRecording(true);
            socket.onmessage = (event) => {console.log('Server says:', event.data)};  // Log the server's response
            socket.onclose = () => {console.log('WebSocket connection closed');};
            socket.onerror = (error) => {console.error('WebSocket error:', error);};
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const stopRecording = () => {
        // // Close the WebSocket connection if it's open or in the process of closing
        // if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        //     console.log('Closing WebSocket connection');
        //     socket.close();
        // } else {
        //     console.log('WebSocket connection is already closed or closing');
        // }
        if (mediaRecorder && mediaRecorder.state !== "inactive" && audioStream) {
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

    const uploadAudio = async (audioBlob: Blob) => {
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