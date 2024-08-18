import React, { useState } from 'react';

interface InputAreaProps {
    onSendMessage: (content: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage }) => {
    const [inputMessage, setInputMessage] = useState('');

    const handleSend = () => {
        if (inputMessage.trim()) {
            onSendMessage(inputMessage);
            setInputMessage('');
        }
    };

    return (
        <div className="flex mb-4">
            <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-grow mr-2 p-2 border border-gray-300 text-black rounded"
            />
            <button
                onClick={handleSend}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
            >
                Send
            </button>
        </div>
    );
};

export default InputArea;