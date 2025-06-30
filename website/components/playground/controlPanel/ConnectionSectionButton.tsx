import React from 'react';

interface ConnectionControlSectionProps {
  title: string;
  isConnected: boolean;
  isSyncing: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onUpdateRealAngles: () => void;
  onToggleSync: () => void;
}

const ConnectionControlSection: React.FC<ConnectionControlSectionProps> = ({
  title,
  isConnected,
  isSyncing,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
  onUpdateRealAngles,
  onToggleSync,
}) => {
  const handleConnectionClick = () => {
    isConnected ? onDisconnect() : onConnect();
  };

  const connectText = isConnecting
    ? 'Connecting...'
    : isDisconnecting
    ? 'Disconnecting...'
    : isConnected
    ? `Disconnect ${title}`
    : `Connect Real Robot By ${title}`;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        onClick={handleConnectionClick}
        disabled={isConnecting || isDisconnecting}
        className={`h-10 text-sm px-4 py-1.5 rounded text-white ${
          isConnected ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
        } ${isConnecting || isDisconnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {connectText}
      </button>

      {isConnected && (
        <>
          <button
            onClick={onUpdateRealAngles}
            className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded"
          >
            Update Real Angles
          </button>

          <button
            onClick={onToggleSync}
            className={`h-10 ${
              isSyncing ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            } text-white text-sm px-4 py-1.5 rounded`}
          >
            {isSyncing ? 'Stop Update Virtual Angles' : 'Start Update Virtual Angles'}
          </button>
        </>
      )}
    </div>
  );
};

export default ConnectionControlSection;
