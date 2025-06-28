"use client";

import React, { useState } from "react";
import {
  JointState,
  UpdateJointDegrees,
  UpdateJointsDegrees,
} from "../../../hooks/useRobotControl"; // Adjusted import path
import { RevoluteJointsTable  } from "./RevoluteJointsTable"; // Updated import path
import DirectionButton from "./DirectionButton";
import { RobotConfig } from "@/config/robotConfig";
import { SettingsWebSocketModal } from "./SettingsWebSocketModal"; // Import the modal component

// --- Control Panel Component ---
type ControlPanelProps = {
  jointStates: JointState[]; // Use JointState type from useRobotControl
  updateJointDegrees: UpdateJointDegrees; // Updated type
  updateJointsDegrees: UpdateJointsDegrees; // Updated type
  isSerialConnected: boolean;
  isWebSocketConnected: boolean;
  robotName: string;
  connectRobotBySerial: () => void;
  disconnectRobotBySerial: () => void;
  connectRobotByWebSocket: (url: string) => void;
  disconnectRobotByWebSocket: () => void;
  getfeedbackBySerial: () => void;
  getfeedbackByWebSocket: () => void;
  keyboardControlMap: RobotConfig["keyboardControlMap"]; // New prop for keyboard control
  CoordinateControls?: RobotConfig["CoordinateControls"]; // Use type from robotConfig
};

export function ControlPanel({
  jointStates,
  updateJointDegrees,
  updateJointsDegrees,
  isSerialConnected,
  isWebSocketConnected,
  robotName,
  connectRobotBySerial,
  disconnectRobotBySerial,
  connectRobotByWebSocket,
  disconnectRobotByWebSocket,
  getfeedbackBySerial,
  getfeedbackByWebSocket,
  keyboardControlMap, // Destructure new prop
  CoordinateControls, // Destructure new prop
}: ControlPanelProps) {
  const [isForward, setIsForward] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [serialConnectionStatus, setSerialConnectionStatus] = useState<
    "idle" | "connecting" | "disconnecting"
  >("idle");
  const [webSocketConnectionStatus, setWebSocketConnectionStatus] = useState<
    "idle" | "connecting" | "disconnecting"
  >("idle");
  const [showWsModal, setShowWsModal] = useState(false);
  
  const handleConnectBySerial = async () => {
    setSerialConnectionStatus("connecting");
    try {
      await connectRobotBySerial();
    } finally {
      setSerialConnectionStatus("idle");
    }
  };

  const handleDisconnectBySerial = async () => {
    setSerialConnectionStatus("disconnecting");
    try {
      await disconnectRobotBySerial();
    } finally {
      setSerialConnectionStatus("idle");
    }
  };

  const updatefeedbackBySerial = async () => {
    try {
      await getfeedbackBySerial();
    } catch (error) {
      console.error("Error updating joint angles:", error);
    }
  };
  
  const handleConnectByWebSocket = () => {
    setShowWsModal(true);  
  };

  const handleConfirmWsModal = async (inputUrl: string) => {
    try {
      setWebSocketConnectionStatus("connecting");
      await connectRobotByWebSocket(inputUrl);
      localStorage.setItem("ws_server_url", inputUrl);
      setShowWsModal(false);
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      alert("connection failed, please check the address");
    } finally {
      setWebSocketConnectionStatus("idle");
    }
  };

 const handleDisconnectByWebSocket = async () => {
    setWebSocketConnectionStatus("disconnecting");
    try {
      await disconnectRobotByWebSocket();
    } finally {
      setWebSocketConnectionStatus("idle");
    }
  };

  const updatefeedbackByWebSocket = async () => {
    try {
      await getfeedbackByWebSocket();
    } catch (error) {
      console.error("Error updating joint angles:", error);
    }
  };
  // Separate jointStates into revolute and continuous categories
  const revoluteJoints = jointStates.filter(
    (state) => state.jointType === "revolute"
  );

  if (isCollapsed) {
    return (
      <div className="absolute bottom-5 left-5 z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded"
        >
          Show Controls
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-5 left-5 bg-zinc-900 bg-opacity-80 text-white p-4 rounded-lg max-h-[90vh] overflow-y-auto z-50 text-sm">
      <h3 className="mt-0 mb-4 border-b border-zinc-600 pb-1 font-bold text-base flex justify-between items-center">
        <span>Controls</span>
        <div>
          <span>Direction</span>
          </div>
          <DirectionButton isForward={isForward} onToggle={setIsForward} />
        <button
          onClick={() => setIsCollapsed(true)}
          className="ml-2 text-xl hover:bg-zinc-800 px-2 rounded-full"
          title="Collapse"
        >
          ×
        </button>
      </h3>
      {/* Revolute Joints Table */}
      {revoluteJoints.length > 0 && (
        <RevoluteJointsTable
          joints={revoluteJoints}
          updateJointDegrees={updateJointDegrees}
          updateJointsDegrees={updateJointsDegrees}
          keyboardControlMap={keyboardControlMap}
          CoordinateControls={CoordinateControls}
          isReverse={!isForward}
          robotName={robotName}
        />
      )}

      {/* Connection Controls */}
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={isSerialConnected ? handleDisconnectBySerial : handleConnectBySerial}
          disabled={serialConnectionStatus !== "idle"}
          className={`h-10 text-sm px-4 py-1.5 rounded text-white ${
            !!isSerialConnected
              ? "bg-red-600 hover:bg-red-500"
              : "bg-blue-600 hover:bg-blue-500"
          } ${serialConnectionStatus !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {serialConnectionStatus === "connecting"
            ? "Connecting..."
            : serialConnectionStatus === "disconnecting"
            ? "Disconnecting..."
            : isSerialConnected
            ? "Disconnect Robot"
            : "Connect Real Robot By Serial"}
        </button>

        {isSerialConnected && (
          <button
            onClick={updatefeedbackBySerial}
            className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded"
          >
            Update Real Angles
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={isWebSocketConnected ? handleDisconnectByWebSocket : handleConnectByWebSocket}
          disabled={webSocketConnectionStatus !== "idle"}
          className={`h-10 text-sm px-4 py-1.5 rounded text-white ${
            isWebSocketConnected ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
          } ${webSocketConnectionStatus !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {webSocketConnectionStatus === "connecting"
            ? "Connecting..."
            : webSocketConnectionStatus === "disconnecting"
            ? "Disconnecting..."
            : isWebSocketConnected
            ? "Disconnect Robot"
            : "Connect Real Robot By WebSocket"}
        </button>

        {isWebSocketConnected && (
          <button
            onClick={updatefeedbackByWebSocket}
            className="h-10 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded"
          >
            Update Real Angles
          </button>
        )}
      </div>

      <SettingsWebSocketModal
        show={showWsModal}
        onClose={() => setShowWsModal(false)}
        onConfirm={handleConfirmWsModal}
      />     
    </div>
  );
}
