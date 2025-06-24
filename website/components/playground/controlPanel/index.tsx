"use client";

import React, { useState } from "react";
import {
  JointState,
  UpdateJointDegrees,
  UpdateJointsDegrees,
} from "../../../hooks/useRobotControl"; // Adjusted import path
import { RevoluteJointsTable, controlDirection  } from "./RevoluteJointsTable"; // Updated import path
import ToggleButton from "../ToggleButton";
import { RobotConfig } from "@/config/robotConfig";

// const baudRate = 1000000; // Define baud rate for serial communication - Keep if needed elsewhere, remove if only for UI

// --- Control Panel Component ---
type ControlPanelProps = {
  jointStates: JointState[]; // Use JointState type from useRobotControl
  updateJointDegrees: UpdateJointDegrees; // Updated type
  updateJointsDegrees: UpdateJointsDegrees; // Updated type

  isConnected: boolean;

  connectRobot: () => void;
  disconnectRobot: () => void;
  keyboardControlMap: RobotConfig["keyboardControlMap"]; // New prop for keyboard control
  CoordinateControls?: RobotConfig["CoordinateControls"]; // Use type from robotConfig
};

export function ControlPanel({
  jointStates,
  updateJointDegrees,
  updateJointsDegrees,
  isConnected,
  connectRobot,
  disconnectRobot,
  keyboardControlMap, // Destructure new prop
  CoordinateControls, // Destructure new prop
}: ControlPanelProps) {
  const [isForward, setIsForward] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "disconnecting"
  >("idle");

  const handleConnect = async () => {
    setConnectionStatus("connecting");
    try {
      await connectRobot();
    } finally {
      setConnectionStatus("idle");
    }
  };

  const handleDisconnect = async () => {
    setConnectionStatus("disconnecting");
    try {
      await disconnectRobot();
    } finally {
      setConnectionStatus("idle");
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
    <div className="absolute bottom-5 inset-x-2 sm:left-5 sm:right-auto max-w-full left-5 bg-zinc-900 bg-opacity-80 text-white p-4 rounded-lg max-h-[90vh] overflow-y-auto z-50 text-sm">
      <h3 className="mt-0 mb-4 border-b border-zinc-600 pb-1 font-bold text-base flex justify-between items-center flex-wrap gap-2">
        <span>Controls</span>
        <div className="flex items-center gap-2">
          <span>Direction</span>
          </div>
          <ToggleButton isForward={isForward} onToggle={setIsForward} />
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
        />
      )}

      {/* Connection Controls */}
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={connectionStatus !== "idle"}
          className={`text-white text-sm px-3 py-1.5 rounded w-full ${
            isConnected
              ? "bg-red-600 hover:bg-red-500"
              : "bg-blue-600 hover:bg-blue-500"
          } ${
            connectionStatus !== "idle" ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {connectionStatus === "connecting"
            ? "Connecting..."
            : connectionStatus === "disconnecting"
            ? "Disconnecting..."
            : isConnected
            ? "Disconnect Robot"
            : "Connect Real Robot"}
        </button>
      </div>
    </div>
  );
}
