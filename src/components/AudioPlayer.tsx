import React from 'react';

interface AudioPlayerProps {
    isPlaying: boolean;
    onStop: () => void;
    onVolumeChange: (volume: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ isPlaying, onStop, onVolumeChange }) => {
    return (
        <div className="mt-4">
            <button
                onClick={onStop}
                className="bg-red-500 text-white px-4 py-2 rounded"
            >
                {isPlaying ? 'Stop' : 'Audio Stopped'}
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="ml-4"
            />
        </div>
    );
};

export default AudioPlayer;