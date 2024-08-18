// File: components/AudioRecorder.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
    onAudioRecorded: (audioBlob: Blob) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    const updateDebugInfo = useCallback((info: string) => {
        setDebugInfo(prev => `${prev}\n${info}`);
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: { ideal: 16000 },
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            updateDebugInfo('Microphone access granted');

            let mimeType = 'audio/webm';
            let options = {};

            // Check for supported MIME types
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                mimeType = 'audio/ogg;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            }

            options = { mimeType };
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    updateDebugInfo(`Received audio chunk: ${event.data.size} bytes`);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                onAudioRecorded(audioBlob);
                updateDebugInfo(`Recording stopped. Total size: ${audioBlob.size} bytes`);
            };

            mediaRecorderRef.current.start(1000);
            setIsRecording(true);
            updateDebugInfo('Recording started');

            // Start the timer
            setRecordingDuration(0);
            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            updateDebugInfo(`Error starting recording: ${error}`);
        }
    }, [onAudioRecorded, updateDebugInfo]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            updateDebugInfo('Recording stopped');

            // Clear the timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [updateDebugInfo]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    return (
        <div className="mb-4">
            <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-2 rounded ${isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white transition duration-200`}
            >
                {isRecording ? `Stop Recording (${recordingDuration}s)` : 'Start Recording'}
            </button>
            {isRecording && (
                <div className="mt-2 text-sm text-gray-600">
                    Recording in progress... {recordingDuration} seconds
                </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
            </div>
        </div>
    );
};

export default AudioRecorder;