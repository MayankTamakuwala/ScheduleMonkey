import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import MessageList from './MessageList';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import TranscriptionDisplay from './TranscriptionDisplay';
import DebugInfo from './DebugInfo';
import ErrorBoundary from './ErrorBoundary';
import { Message } from '@/types/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useAuth } from '@/app/authContext';

const ChatAssistant: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');
    const [userId, setUserId] = useState<string>('');
    const [conversationId, setConversationId] = useState<string>('');
    const [debugLog, setDebugLog] = useState<string[]>([]);

    const {
        sendMessage: sendWebSocketMessage,
        lastMessage,
        connectionStatus
    } = useWebSocket('ws://localhost:8000/ws');

    const {
        isPlaying,
        playAudio,
        stopAudio,
        audioDebugInfo,
        handleVolumeChange
    } = useAudioPlayback();

    const { user } = useAuth();

    const addDebugLog = useCallback((message: string) => {
        setDebugLog(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
        console.log(message);
    }, []);

    useEffect(() => {
        if (user) {
            setUserId(user.uid);
        }
    }, [user]);

    useEffect(() => {
        setConversationId(`conv_${Math.random().toString(36).substr(2, 9)}`);
    }, []);

    const handleMessage = useCallback((data: any) => {
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
            default:
                addDebugLog(`Unknown message type: ${data.type}`);
        }
    }, [addDebugLog]);

    useEffect(() => {
        if (lastMessage) {
            addDebugLog(`Received message type: ${typeof lastMessage}`);
            try {
                if (typeof lastMessage === 'string') {
                    const data = JSON.parse(lastMessage);
                    addDebugLog(`Parsed message type: ${data.type}`);
                    handleMessage(data);
                } else if (lastMessage instanceof Blob) {
                    addDebugLog(`Received audio blob: ${lastMessage.size} bytes, type: ${lastMessage.type}`);
                    playAudio(lastMessage);
                } else {
                    addDebugLog(`Unexpected message format: ${typeof lastMessage}`);
                }
            } catch (err) {
                addDebugLog(`Error processing WebSocket message: ${err}`);
                setError('Error processing message from server');
            }
        }
    }, [lastMessage, playAudio, addDebugLog, handleMessage]);

    const handleAudioRecorded = useCallback((audioBlob: Blob) => {
        addDebugLog(`Audio recorded: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const audioData = {
                type: 'audio',
                mimeType: audioBlob.type,
                data: base64data.split(',')[1],
                user_id: userId,
                conversation_id: conversationId
            };
            sendWebSocketMessage(JSON.stringify(audioData));
            addDebugLog('Audio data sent to server');
        };
        reader.readAsDataURL(audioBlob);
    }, [sendWebSocketMessage, userId, conversationId, addDebugLog]);

    const memoizedMessageList = useMemo(() => (
        <List
            height={400}
            itemCount={messages.length}
            itemSize={50}
            width="100%"
        >
            {({ index, style }: { index: any, style: any }) => (
                <div style={style}>
                    <MessageList messages={[messages[index]]} />
                </div>
            )}
        </List>
    ), [messages]);

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
                {memoizedMessageList}
                <AudioRecorder onAudioRecorded={handleAudioRecorded} />
                <AudioPlayer
                    isPlaying={isPlaying}
                    onStop={stopAudio}
                    onVolumeChange={handleVolumeChange}
                />
                {/* <TranscriptionDisplay transcription={transcription} /> */}
                {error && <div role="alert" className="text-red-500 font-bold mb-4">{error}</div>}
                {/* <DebugInfo
                    audioDebugInfo={audioDebugInfo}
                    connectionStatus={connectionStatus}
                    userId={userId}
                    conversationId={conversationId}
                /> */}
                {/* <div className="mt-4 p-4 bg-gray-100 rounded">
                    <h3 className="font-bold">Debug Log:</h3>
                    <pre className="text-xs mt-2 max-h-40 overflow-auto">
                        {debugLog.join('\n')}
                    </pre>
                </div> */}
            </div>
        </ErrorBoundary>
    );
};

export default ChatAssistant;