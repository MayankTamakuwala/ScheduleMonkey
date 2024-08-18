import React from 'react';

interface DebugInfoProps {
    audioDebugInfo: string;
    connectionStatus: string;
}

const DebugInfo: React.FC<DebugInfoProps> = ({ audioDebugInfo, connectionStatus }) => {
    return (
        <div className="mt-4 p-4 bg-yellow-100 text-black rounded-lg">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <p>Connection Status: {connectionStatus}</p>
            <pre className="whitespace-pre-wrap text-xs">{audioDebugInfo}</pre>
        </div>
    );
};

export default DebugInfo;
