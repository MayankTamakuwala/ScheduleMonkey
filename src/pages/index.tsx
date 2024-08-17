import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const Home: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');
    const webSocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        // Initialize WebSocket connection
        webSocketRef.current = new WebSocket('ws://localhost:8000/ws');

        webSocketRef.current.onopen = () => {
            console.log('WebSocket connection established');
        };

        webSocketRef.current.onmessage = (event) => {
            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'transcription':
                        setTranscription(data.text);
                        break;
                    case 'response':
                        setMessages(prevMessages => [
                            ...prevMessages,
                            { role: 'assistant', content: data.text }
                        ]);
                        break;
                    case 'error':
                        setError(data.message);
                        break;
                }
            } else if (event.data instanceof Blob) {
                // Handle audio data
                const audioUrl = URL.createObjectURL(event.data);
                const audio = new Audio(audioUrl);
                audio.onended = () => setIsPlaying(false);
                audio.play();
                setIsPlaying(true);
            }
        };

        webSocketRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            setError('WebSocket connection error');
        };

        webSocketRef.current.onclose = () => {
            console.log('WebSocket connection closed');
        };

        // Clean up WebSocket connection on component unmount
        return () => {
            if (webSocketRef.current) {
                webSocketRef.current.close();
            }
        };
    }, []);

    const handleSendMessage = useCallback(async (content: string) => {
        const newMessage: Message = { role: 'user', content };
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        setInputMessage('');

        try {
            const response = await fetch('http://localhost:8000/chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // TODO: Replace with actual user ID & conversation ID
                body: JSON.stringify({
                    messages: [...messages, newMessage],
                    // user_id: 'user123', 
                    // conversation_id: 'conv123',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const data = await response.json();
            const assistantMessage: Message = { role: 'assistant', content: data.message };
            setMessages((prevMessages) => [...prevMessages, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message');
        }
    }, [messages]);

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
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                sendAudioToServer(audioBlob);
            };

            mediaRecorderRef.current.start(1000);
            setIsRecording(true);
            setError('');
        } catch (error) {
            console.error('Error starting recording:', error);
            setError(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);


    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    }, []);

    const sendAudioToServer = useCallback((audioBlob: Blob) => {
        if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                const audioData = {
                    mimeType: audioBlob.type,
                    data: base64data.split(',')[1]
                };
                webSocketRef.current!.send(JSON.stringify(audioData));
            };
            reader.readAsDataURL(audioBlob);
        } else {
            setError('WebSocket is not connected');
        }
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
            <Head>
                <title>AI Chat Assistant</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="relative py-3 sm:max-w-xl sm:mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
                <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
                    <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">AI Chat Assistant</h1>

                    <div className="h-96 overflow-y-auto mb-4 p-4 border border-gray-300 rounded-lg">
                        {messages.map((message, index) => (
                            <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                                <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                    {message.content}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex mb-4">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
                            placeholder="Type your message..."
                            className="flex-grow mr-2 p-2 border border-gray-300 rounded"
                        />
                        <button
                            onClick={() => handleSendMessage(inputMessage)}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
                        >
                            Send
                        </button>
                    </div>

                    <div className="mb-4">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-full py-2 rounded ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white transition duration-200`}
                        >
                            {isRecording ? 'Stop Recording' : 'Start Recording'}
                        </button>
                    </div>

                    {transcription && (
                        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                            <h3 className="font-bold mb-2">Transcription:</h3>
                            <p>{transcription}</p>
                        </div>
                    )}

                    {error && <div className="text-red-500 font-bold">{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default Home;