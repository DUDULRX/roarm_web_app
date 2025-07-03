"use client";

import { useEffect, useState, Suspense } from "react";
import { robotConfigMap } from "@/config/robotConfig";
import * as THREE from "three";
import { Html, useProgress } from "@react-three/drei";
import { ControlPanel } from "./keyboardControl/KeyboardControl";
import { useRobotControl } from "@/hooks/useRobotControl";
import { Canvas } from "@react-three/fiber";
import { ChatControl } from "./chatControl/ChatControl"; // Import ChatControl component
import { LeaderControl }from "../playground/leaderControl/LeaderControl";
import { useLeaderRobotControl } from "@/hooks/useLeaderRobotControl";
import { RobotScene } from "./RobotScene";
import KeyboardControlButton from "../playground/controlButtons/KeyboardControlButton";
import ChatControlButton from "../playground/controlButtons/ChatControlButton";
import LeaderControlButton from "../playground/controlButtons/LeaderControlButton";
import RecordButton from "./controlButtons/RecordButton";
import RecordControl from "./recordControl/RecordControl";
import {
  getPanelStateFromLocalStorage,
  setPanelStateToLocalStorage,
} from "@/lib/panelSettings";
import { TooltipProvider } from "@/components/ui/tooltip";

export type JointDetails = {
  name: string;
  servoId: number;
  limit: {
    lower?: number;
    upper?: number;
  };
  jointType: "revolute" | "continuous";
};

export type CoordinateDetails = {
  name: string;
  axisId: number;
};

type RobotLoaderProps = {
  robotName: string;
};

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center className="text-4xl text-white">
      {progress} % loaded
    </Html>
  );
}

export default function RobotLoader({ robotName }: RobotLoaderProps) {
  const [jointDetails, setJointDetails] = useState<JointDetails[]>([]);
  const [coordinateDetails, setCoordinateDetails] = useState<CoordinateDetails[]>([
  { name: "X", axisId: 0 },
  { name: "Y", axisId: 1 },
  { name: "Z", axisId: 2 },
  { name: "Roll", axisId: 3 },
  { name: "Pitch", axisId: 4 },
  ]);  
  const [showControlPanel, setShowControlPanel] = useState(() => {
  const stored = getPanelStateFromLocalStorage("keyboardControl", robotName);
    return stored !== null ? stored : window.innerWidth >= 900;
  });
  const [showLeaderControl, setShowLeaderControl] = useState(() => {
    return getPanelStateFromLocalStorage("leaderControl", robotName) ?? false;
  });
  const [showChatControl, setShowChatControl] = useState(() => {
    return getPanelStateFromLocalStorage("chatControl", robotName) ?? false;
  });
  const [showRecordControl, setShowRecordControl] = useState(() => {
    return getPanelStateFromLocalStorage("recordControl", robotName) ?? false;
  });

  const config = robotConfigMap[robotName];
  if (!config) {
    throw new Error(`Robot configuration for "${robotName}" not found.`);
  }

  // Initialize leader robot control hook
  const leaderControl = useLeaderRobotControl();

  const {
    urdfUrl,
    orbitTarget,
    camera,
    keyboardControlMap,
    gamepadControlMap,
    CoordinateControls,
    systemPrompt, // <-- Add this line
  } = config; // Extract compoundMovements and systemPrompt

  const {
    isSerialConnected,
    isWebSocketConnected,
    connectRobot,
    TorqueSet,
    updateAngles,
    disconnectRobot,
    jointStates,
    coordinateStates,
    setJointDetails: updateJointDetails,
    setCoordinateDetails: updateCoordinateDetails,
    updateJointDegrees,
    updateJointsDegrees,
    UpdateCoordinates,
    isRecording,
    recordData,
    startRecording,
    stopRecording,
    clearRecordData,
  } = useRobotControl(jointDetails,coordinateDetails,robotName);

  useEffect(() => {
    updateCoordinateDetails(coordinateDetails);
  }, [coordinateDetails, updateCoordinateDetails]);

  useEffect(() => {
    updateJointDetails(jointDetails);
  }, [jointDetails, updateJointDetails]);

  // Functions to handle panel state changes and localStorage updates
  const toggleControlPanel = () => {
    setShowControlPanel((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("keyboardControl", newState, robotName);
      return newState;
    });
  };

  const toggleLeaderControl = () => {
    setShowLeaderControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("leaderControl", newState, robotName);
      return newState;
    });
  };

  const toggleChatControl = () => {
    setShowChatControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("chatControl", newState, robotName);
      return newState;
    });
  };

  const toggleRecordControl = () => {
    setShowRecordControl((prev) => {
      const newState = !prev;
      setPanelStateToLocalStorage("recordControl", newState, robotName);
      return newState;
    });
  };

  const hideControlPanel = () => {
    setShowControlPanel(false);
    setPanelStateToLocalStorage("keyboardControl", false, robotName);
  };

  const hideLeaderControl = () => {
    setShowLeaderControl(false);
    setPanelStateToLocalStorage("leaderControl", false, robotName);
  };

  const hideChatControl = () => {
    setShowChatControl(false);
    setPanelStateToLocalStorage("chatControl", false, robotName);
  };

  const hideRecordControl = () => {
    setShowRecordControl(false);
    setPanelStateToLocalStorage("recordControl", false, robotName);
  };

  return (
    <TooltipProvider>
      <Canvas
        shadows
        camera={{
          position: camera.position,
          fov: camera.fov,
        }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(0x263238);
        }}
      >
        <Suspense fallback={<Loader />}>
          <RobotScene
            robotName={robotName}
            urdfUrl={urdfUrl}
            orbitTarget={orbitTarget}
            setJointDetails={setJointDetails}
            jointStates={jointStates}
          />        
        </Suspense>
      </Canvas>
      <ControlPanel
        show={showControlPanel}
        onHide={hideControlPanel}      
        jointStates={jointStates}
        coordinateStates={coordinateStates}
        updateJointDegrees={updateJointDegrees}
        updateJointsDegrees={updateJointsDegrees}
        updateCoordinates={UpdateCoordinates}
        isSerialConnected={isSerialConnected}
        isWebSocketConnected={isWebSocketConnected}
        robotName={robotName}
        connectRobot={connectRobot}
        TorqueSet={TorqueSet}
        updateAngles={ updateAngles}
        disconnectRobot={disconnectRobot}
        keyboardControlMap={keyboardControlMap}
        gamepadControlMap={gamepadControlMap}
        CoordinateControls={CoordinateControls}
      />
      
      {/* <ChatControl 
      show={showControlPanel}
      onHide={hideControlPanel}
      robotName={robotName} 
      systemPrompt={systemPrompt} 
      />  */}
           
      {/* LeaderControl overlay */}
      <LeaderControl
        show={showLeaderControl}
        onHide={hideLeaderControl}
        jointDetails={jointDetails}
        robotName={robotName}
        leaderControl={leaderControl}        
        onSync={(leaderAngles: { servoId: number; angle: number }[]) => {
          const revoluteJoints = jointDetails.filter(
            (j) => j.jointType === "revolute"
          );
          const revoluteServoIds = new Set(
            revoluteJoints.map((j) => j.servoId)
          );
          updateJointsDegrees(
            leaderAngles
              .filter((la) => revoluteServoIds.has(la.servoId))
              .map(
                ({ servoId, angle }: { servoId: number; angle: number }) => ({
                  servoId,
                  value: angle,
                })
              )
          );
        }}
      />

      {/* Record Control overlay */}
      <RecordControl
        show={showRecordControl}
        onHide={hideRecordControl}
        isRecording={isRecording}
        recordData={recordData}
        startRecording={startRecording}
        stopRecording={stopRecording}
        clearRecordData={clearRecordData}
        updateJointsDegrees={updateJointsDegrees}
        jointDetails={jointDetails}
        leaderControl={leaderControl}
      />   

      <div className="absolute bottom-5 left-0 right-0"> 
        <div className="flex justify-center items-center">
          <div className="flex gap-2 max-w-md">
            <LeaderControlButton
              showControlPanel={showLeaderControl}
              onToggleControlPanel={toggleLeaderControl}
            /> 
            <KeyboardControlButton 
               showControlPanel={showControlPanel}
               onToggleControlPanel={toggleControlPanel}
            />
            {/* <ChatControlButton
               showControlPanel={showChatControl}
               onToggleControlPanel={toggleChatControl}
            /> */}
            <RecordButton
               showControlPanel={showRecordControl}
               onToggleControlPanel={toggleRecordControl}
            />
          </div>
        </div>
      </div>       
    </TooltipProvider>
  );
}

