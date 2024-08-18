// src/components/ChatAssistant.tsx
import React, { useState, useEffect, useCallback } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import TranscriptionDisplay from './TranscriptionDisplay';
import DebugInfo from './DebugInfo';
import { Message } from '@/types/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';

const ChatAssistant: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');

    const {
        sendMessage: sendWebSocketMessage,
        lastMessage,
        connectionStatus
    } = useWebSocket('ws://localhost:8000/ws');

    const {
        audioBlob,
        isPlaying,
        playAudio,
        audioDebugInfo,
        audioRef,
        handleVolumeChange
    } = useAudioPlayback();

    useEffect(() => {
        if (lastMessage) {
            if (typeof lastMessage === 'string') {
                const data = JSON.parse(lastMessage);
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
            } else if (lastMessage instanceof Blob) {
                playAudio(lastMessage);
            }
        }
    }, [lastMessage, playAudio]);

    const handleSendMessage = useCallback((content: string) => {
        const newMessage: Message = { role: 'user', content };
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        sendWebSocketMessage(JSON.stringify({
            type: 'chat',
            message: content
        }));
    }, [sendWebSocketMessage]);

    const handleAudioRecorded = useCallback((audioBlob: Blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const audioData = {
                type: 'audio',
                mimeType: audioBlob.type,
                data: base64data.split(',')[1] // Remove the "data:audio/xxx;base64," part
            };
            sendWebSocketMessage(JSON.stringify(audioData));
        };
        reader.readAsDataURL(audioBlob);
    }, [sendWebSocketMessage]);

    return (
        <>
            <MessageList messages={messages} />
            <InputArea onSendMessage={handleSendMessage} />
            <AudioRecorder onAudioRecorded={handleAudioRecorded} />
            <AudioPlayer
                audioRef={audioRef}
                isPlaying={isPlaying}
                onVolumeChange={handleVolumeChange}
            />
            <TranscriptionDisplay transcription={transcription} />
            {error && <div className="text-red-500 font-bold mb-4">{error}</div>}
            <DebugInfo
                audioDebugInfo={audioDebugInfo}
                connectionStatus={connectionStatus}
            />
            {audioBlob && (
                <div className="mt-4">
                    <button
                        onClick={() => playAudio(audioBlob)}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-200"
                    >
                        Retry Audio Playback
                    </button>
                </div>
            )}
        </>
    );
};

export default ChatAssistant;
