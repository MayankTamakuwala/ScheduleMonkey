import React from 'react';

interface AudioPlayerProps {
    audioRef: React.RefObject<HTMLAudioElement>;
    isPlaying: boolean;
    onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioRef, isPlaying, onVolumeChange }) => {
    return (
        <div className="mt-4">
            <audio
                ref={audioRef}
                controls
                className="w-full"
            />
            {isPlaying && (
                <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                    <p className="text-blue-800">Playing audio response...</p>
                </div>
            )}
            <div className="mt-4">
                <label htmlFor="volume" className="block text-sm font-medium text-gray-700">
                    Volume
                </label>
                <input
                    type="range"
                    id="volume"
                    name="volume"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue="1"
                    onChange={onVolumeChange}
                    className="mt-1 block w-full"
                />
            </div>
        </div>
    );
};

export default AudioPlayer;
