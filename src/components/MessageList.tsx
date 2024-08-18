import React from 'react';
import { Message } from '@/types/chat';

interface MessageListProps {
    messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    return (
        <div className="h-96 overflow-y-auto mb-4 p-4 border border-gray-300 rounded-lg">
            {messages.map((message, index) => (
                <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                        {message.content}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default MessageList;
