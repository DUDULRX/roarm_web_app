// components/ToggleButton.tsx
import React, { useEffect } from 'react';

interface DirectionButtonProps {
  isForward: boolean;
  onToggle: (newState: boolean) => void;
}

const DirectionButton: React.FC<DirectionButtonProps> = ({ isForward, onToggle }) => {
  const handleClick = () => {
    onToggle(!isForward); // 点击切换方向
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 's') {
        onToggle(!isForward); // 按 r 键也切换方向
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown); // 卸载监听
    };
  }, [isForward, onToggle]);

  return (
    <button
      onClick={handleClick}
      className={`px-4 py-2 text-lg border rounded ${
        isForward ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {isForward ? 'correct' : 'reverse'}
    </button>
  );
};

export default DirectionButton;
