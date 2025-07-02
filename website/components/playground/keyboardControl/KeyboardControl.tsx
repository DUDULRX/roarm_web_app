"use client";

import React, { useRef, useState, useEffect } from "react";
import { Rnd } from "react-rnd";
import useMeasure from "react-use-measure";
import {
  JointState,
  CoordinateState,
  UpdateJointDegrees,
  UpdateJointsDegrees,
  UpdateCoordinates,
} from "../../../hooks/useRobotControl"; // Adjusted import path
import { RevoluteJointsTable  } from "./RevoluteJointsTable"; // Updated import path
import ConnectionControlSection from "../controlButtons/ConnectionSectionButton";
import { SettingsWebSocketModal } from "../controlButtons/SettingsWebSocketModal"; // Import the modal component
import DirectionButton from "./DirectionButton";

import { RobotConfig } from "@/config/robotConfig";
import { Roarm } from "roarm-sdk";
import { panelStyle } from "@/components/playground/panelStyle";
import { RobotConnectionHelpDialog } from "./RobotConnectionHelpDialog";

// --- Control Panel Component ---
type ControlPanelProps = {
  jointStates: JointState[]; // Use JointState type from useRobotControl
  coordinateStates: CoordinateState[];
  updateJointDegrees: UpdateJointDegrees; // Updated type
  updateJointsDegrees: UpdateJointsDegrees; // Updated type
  updateCoordinates:UpdateCoordinates;
  isSerialConnected: boolean;
  isWebSocketConnected: boolean;
  robotName: string;
  connectRobot: (options: { roarm?: Roarm; url?: string }) => Promise<void> | void;
  TorqueSet: (cmd: number) => void;
  updateAngles: (type: string) => void;
  disconnectRobot: () => void;
  keyboardControlMap: RobotConfig["keyboardControlMap"]; // New prop for keyboard control
  CoordinateControls?: RobotConfig["CoordinateControls"]; // Use type from robotConfig
  onHide?: () => void; 
  show?: boolean; 
};

export function ControlPanel({
  show = true,
  onHide,
  jointStates,
  coordinateStates,
  updateCoordinates,
  updateJointDegrees,
  updateJointsDegrees,
  isSerialConnected,
  isWebSocketConnected,
  robotName,
  connectRobot,
  TorqueSet,
  updateAngles,
  disconnectRobot,
  keyboardControlMap, // Destructure new prop
  CoordinateControls, // Destructure new prop
}: ControlPanelProps) {
  const [isForward, setIsForward] = useState(true);
  const [serialConnectionStatus, setSerialConnectionStatus] = useState<
    "idle" | "connecting" | "disconnecting"
  >("idle");
  const [webSocketConnectionStatus, setWebSocketConnectionStatus] = useState<
    "idle" | "connecting" | "disconnecting"
  >("idle");
  const [showWsModal, setShowWsModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const roarmRef = useRef<Roarm | null>(null);
  const [ref, bounds] = useMeasure();
  const [hasDragged, setHasDragged] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (bounds.height > 0 && !hasDragged) {
      setPosition((pos) => ({
        ...pos,
        x: window.innerWidth - bounds.width - 20,
        y: window.innerHeight - bounds.height - 20,
      }));
    }
  }, [bounds.height, hasDragged]);
  
  const handleConfirmWsModal = async (inputUrl: string) => {
    try {
      setWebSocketConnectionStatus("connecting");
      await connectRobot({ url: inputUrl });
      console.log(inputUrl);
      localStorage.setItem("ws_server_url", inputUrl);
      setShowWsModal(false);
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      alert("connection failed, please check the address");
    } finally {
      setWebSocketConnectionStatus("idle");
    }
  };

  const handleConnect = async (type:string) => {
    if(type=="Serial"){
      setSerialConnectionStatus("connecting");
      try {
        if (!roarmRef.current) {
          roarmRef.current = new Roarm({ roarm_type: robotName, baudrate: "115200" });
          console.log(roarmRef.current);
        }      
        await connectRobot({ roarm: roarmRef.current });
      } finally {
        setSerialConnectionStatus("idle");
      }
    }else if(type=="WebSocket"){
      setShowWsModal(true);  
    }
  };

  const handleUpdateRealAngles = async () => {
    try {
      await updateAngles("Real");
    } catch (error) {
      console.error("Error updating joint angles:", error);
    }
  };

  const handleDisconnect = async (type:string) => {
    if(type=="Serial"){
      setSerialConnectionStatus("disconnecting");
      try {
        await disconnectRobot();
      } finally {
        setSerialConnectionStatus("idle");
      }
    }else if(type=="WebSocket"){
      setWebSocketConnectionStatus("disconnecting");
      try {
        await disconnectRobot();
      } finally {
        setWebSocketConnectionStatus("idle");
      }
    }

  };

  useEffect(() => {
    let active = true;

    const loop = async () => {
      TorqueSet(0);

      while (active) {
        try {
          await updateAngles("Virtual");
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.error("Loop update failed:", e);
          break;
        }
      }
    };

    if (isSyncing) {
      loop();
    }else {
      TorqueSet(1);
    }

    return () => {
      active = false;
    };
  }, [isSyncing, updateAngles, TorqueSet]);

  // Separate jointStates into revolute and continuous categories
  const revoluteJoints = jointStates.filter(
    (state) => state.jointType === "revolute"
  );

  return (
    <Rnd
      position={position}
      onDragStop={(_, d) => {
        setPosition({ x: d.x, y: d.y });
        setHasDragged(true);
      }}
      bounds="window"
      className="z-50"
      style={{ display: show ? undefined : "none" }}
      dragHandleClassName="drag-handle" 
    >
    <div
        ref={ref}
        className={"max-h-[90vh] overflow-y-auto text-sm " + panelStyle}
      >
        <h3 className=" mt-0 mb-4 border-b border-zinc-600 pb-1 font-bold text-base flex justify-between items-center">
        <span className=" drag-handle" >Keyboard Controls</span>
        <div>
          <span className=" drag-handle" >Direction</span>
        </div>
          <DirectionButton isForward={isForward} onToggle={setIsForward} />
        <button
          onClick={onHide}
          onTouchEnd={onHide}
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
          coordinates={coordinateStates}
          updateCoordinates={updateCoordinates}
          updateJointDegrees={updateJointDegrees}
          updateJointsDegrees={updateJointsDegrees}
          keyboardControlMap={keyboardControlMap}
          CoordinateControls={CoordinateControls}
          isReverse={!isForward}
          robotName={robotName}
        />
      )}

      {/* Connection Controls */}
      {!isWebSocketConnected && (
        <ConnectionControlSection
          title="Serial"
          type=""
          isConnected={isSerialConnected}
          isSyncing={isSyncing}
          isConnecting={serialConnectionStatus === "connecting"}
          isDisconnecting={serialConnectionStatus === "disconnecting"}
          onConnect={() => handleConnect("Serial")}
          onDisconnect={() => handleDisconnect("Serial")}
          onUpdateRealAngles={handleUpdateRealAngles}
          onToggleSync={() => setIsSyncing(prev => !prev)}
        />
      )}

      {!isSerialConnected && (
        <ConnectionControlSection
          title="WebSocket"
          type=""
          isConnected={isWebSocketConnected}
          isSyncing={isSyncing}
          isConnecting={webSocketConnectionStatus === "connecting"}
          isDisconnecting={webSocketConnectionStatus === "disconnecting"}
          onConnect={() => handleConnect("WebSocket")}
          onDisconnect={() => handleDisconnect("WebSocket")}
          onUpdateRealAngles={handleUpdateRealAngles}
          onToggleSync={() => setIsSyncing(prev => !prev)}
        />
      )}

      <SettingsWebSocketModal
        show={showWsModal}
        onClose={() => setShowWsModal(false)}
        onConfirm={handleConfirmWsModal}
      />     
    </div>
    </Rnd>  
  );
}
