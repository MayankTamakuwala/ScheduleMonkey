import React from 'react';

interface TranscriptionDisplayProps {
    transcription: string;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ transcription }) => {
    if (!transcription) return null;

    return (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-bold mb-2">Transcription:</h3>
            <p>{transcription}</p>
        </div>
    );
};

export default TranscriptionDisplay;