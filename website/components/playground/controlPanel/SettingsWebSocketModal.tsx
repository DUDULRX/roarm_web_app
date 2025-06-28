import React, { useState, useEffect, useRef } from "react";

interface SettingsWebSocketModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (url: string) => Promise<void> | void;
}

export const SettingsWebSocketModal: React.FC<SettingsWebSocketModalProps> = ({
  show,
  onClose,
  onConfirm,
}) => {
  const [inputUrl, setInputUrl] = useState("ws://localhost:9090");
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) {
      const savedUrl = localStorage.getItem("ws_server_url");
      if (savedUrl) setInputUrl(savedUrl);
      setError(null);
    }
  }, [show]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (show) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [show, onClose]);

  if (!show) return null;

  const handleConfirmClick = async () => {
    const trimmedUrl = inputUrl.trim();
    if (!trimmedUrl) {
      setError("please enter a valid WebSocket URL");
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmedUrl);
    } catch {
      setError("connection failed, please check the address");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div
        ref={modalRef}
        className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-[320px] max-w-full"
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          please enter WebSocket URL
        </h3>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="w-full px-3 py-2 mb-2 rounded border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
          placeholder="ws://localhost:9090"
          autoFocus
        />
        {error && (
          <p className="text-red-600 text-sm mb-2">{error}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-zinc-700"
          >
            cancel
          </button>
          <button
            onClick={handleConfirmClick}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            connect
          </button>
        </div>
      </div>
    </div>
  );
};
