/**
 * Control virtual degree with this hook, the real degree is auto managed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nan } from "zod";
import { Roarm } from "roarm-sdk";
import { useWebSocketClient } from "@/hooks/useWebSocketClient"; 
import { json } from "stream/consumers";

// import { JointDetails } from "@/components/RobotLoader"; // <-- IMPORT JointDetails type
type JointDetails = {
  name: string;
  servoId: number;
  jointType: "revolute" | "continuous";
  limit?: {
    lower?: number;
    upper?: number;
  };
};

export type JointState = {
  name: string;
  servoId?: number;
  jointType: "revolute" | "continuous";
  limit?: { lower?: number; upper?: number };
  virtualDegrees?: number;
  realDegrees?: number | "N/A" | "error";
  virtualSpeed?: number;
  realSpeed?: number | "N/A" | "error";
};

export type UpdateJointDegrees = (
  servoId: number,
  value: number
) => Promise<void>;

export type UpdateJointsDegrees = (
  updates: { servoId: number; value: number }[]
) => Promise<void>;


export function useRobotControl(
  initialJointDetails: JointDetails[],
  roarm: Roarm | null,
) {
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [jointDetails, setJointDetails] = useState(initialJointDetails);
  const wsClient = useWebSocketClient();

  // Joint states
  const [jointStates, setJointStates] = useState<JointState[]>(
    jointDetails.map((j, index) => ({
      jointType: j.jointType,
      virtualDegrees: j.jointType === "revolute" ? 0 : undefined,
      realDegrees: j.jointType === "revolute" ? "N/A" : undefined,
      virtualSpeed: j.jointType === "continuous" ? 0 : undefined,
      realSpeed: j.jointType === "continuous" ? "N/A" : undefined,
      servoId: j.servoId, // Assign servoId based on index
      name: j.name, // Map name from JointDetails
      limit: j.limit, // Map limit from JointDetails
    }))
  );

  // Store initial positions of servos
  const [initialPositions, setInitialPositions] = useState<number[]>([]);

  useEffect(() => {
    setJointStates(
      jointDetails.map((j, index) => ({
        jointType: j.jointType,
        virtualDegrees: j.jointType === "revolute" ? 0 : undefined,
        realDegrees: j.jointType === "revolute" ? "N/A" : undefined,
        virtualSpeed: j.jointType === "continuous" ? 0 : undefined,
        realSpeed: j.jointType === "continuous" ? "N/A" : undefined,
        servoId: j.servoId, // Assign servoId based on index
        name: j.name, // Map name from JointDetails
        limit: j.limit, // Map limit from JointDetails
      }))
    );
  }, [jointDetails]);

  // Connect to the robot
  const connectRobotBySerial = useCallback(async () => {
    try {
      await roarm.connect();
      setIsSerialConnected(true);
      console.log("Robot connected by serial successfully.");
      const angles = await roarm.joints_angle_get()

      const newStates = [...jointStates];
      const initialPos: number[] = [];
      for (let i = 0; i < jointDetails.length; i++) {
        try {
            initialPos.push(...angles);
            // newStates[i].realDegrees = angles;
            const newStates = [...jointStates];
            for (let i = 0; i < newStates.length; i++) {
              if (typeof angles[i] === 'number') {
                newStates[i].virtualDegrees = angles[i];
                newStates[i].realDegrees = angles[i];
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
            }
            // Enable torque for revolute servos          
        } catch (error) {
          console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
          initialPos.push(0);
          if (jointDetails[i].jointType === "revolute") {
            newStates[i].realDegrees = "error";
          }
        }
      }
      setInitialPositions(initialPos);
      setJointStates(newStates);
      roarm.torque_set(1);
    } catch (error) {
      console.error("Failed to connect to the robot:", error);
    }
  }, [jointStates, jointDetails]);
  // Disconnect from the robot
  const disconnectRobotBySerial = useCallback(async () => {
    try {
      // Disable torque for revolute servos and set wheel speed to 0 for continuous servos
      try {
        roarm.torque_set(0);
      } catch (error) {
        console.error(
          `Failed to reset joint during disconnect:`,
          error
        );
      }

      await roarm.disconnect();
      setIsSerialConnected(false);
      console.log("Robot disconnected successfully.");

      // Reset realDegrees of revolute joints to "N/A"
      setJointStates((prevStates) =>
        prevStates.map((state) =>
          state.jointType === "revolute"
            ? { ...state, realDegrees: "N/A" }
            : { ...state, realSpeed: "N/A" }
        )
      );
    } catch (error) {
      console.error("Failed to disconnect from the robot:", error);
    }
  }, [jointDetails]);

  const getfeedbackBySerial = useCallback(async () => {
    try {
      const newStates = [...jointStates];
      const initialPos: number[] = [];
      const angles = await roarm.joints_angle_get()

      for (let i = 0; i < jointDetails.length; i++) {
        try {
            initialPos.push(...angles);
            // newStates[i].realDegrees = angles;
            const newStates = [...jointStates];
            for (let i = 0; i < newStates.length; i++) {
              if (typeof angles[i] === 'number') {
                newStates[i].realDegrees = angles[i];
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
            }
          
        } catch (error) {
          console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
          if (jointDetails[i].jointType === "revolute") {
            newStates[i].realDegrees = "error";
          }
        }
      }
      setInitialPositions(initialPos);
      setJointStates(newStates);
    } catch (error) {
      console.error("Failed to update feedback to the robot:", error);
    }
  }, [jointStates, jointDetails]);

    // Connect to the robot
  const connectRobotByWebSocket = useCallback(async (url: string) => {
    try {
      await wsClient.connect(url);
      setIsWebSocketConnected(true);
      wsClient.torque_set(1);
      console.log("Robot connected by WebSocket successfully.");
      const angles = await wsClient.joints_angle_get();
      const newStates = [...jointStates];
      const initialPos: number[] = [];
      for (let i = 0; i < jointDetails.length; i++) {
        try {
            initialPos.push(...angles);
            for (let i = 0; i < newStates.length; i++) {
              if (typeof angles[i] === 'number') {
                newStates[i].virtualDegrees = Math.round(angles[i]);
                newStates[i].realDegrees = angles[i];
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
            }
            // Enable torque for revolute servos          
        } catch (error) {
          console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
          initialPos.push(0);
          if (jointDetails[i].jointType === "revolute") {
            newStates[i].realDegrees = "error";
          }
        }
      }
      setInitialPositions(initialPos);
      setJointStates(newStates);
    } catch (error) {
      console.error("Failed to connect to the robot:", error);
    }
  }, [jointStates, jointDetails]);
  // Disconnect from the robot
  const disconnectRobotByWebSocket = useCallback(async () => {
    try {
      // Disable torque for revolute servos and set wheel speed to 0 for continuous servos
      try {
        wsClient.torque_set(0);
      } catch (error) {
        console.error(
          `Failed to reset joint during disconnect:`,
          error
        );
      }
      wsClient.disconnect();
      setIsWebSocketConnected(false);
      console.log("Robot disconnected successfully.");

      // Reset realDegrees of revolute joints to "N/A"
      setJointStates((prevStates) =>
        prevStates.map((state) =>
          state.jointType === "revolute"
            ? { ...state, realDegrees: "N/A" }
            : { ...state, realSpeed: "N/A" }
        )
      );
    } catch (error) {
      console.error("Failed to disconnect from the robot:", error);
    }
  }, [jointDetails]);

  const getfeedbackByWebSocket = useCallback(async () => {
    try {
      const newStates = [...jointStates];
      const initialPos: number[] = [];
      const angles = await wsClient.joints_angle_get();
      // angles = [0,0,0,0,0,0]; // Mock angles for testing

      for (let i = 0; i < jointDetails.length; i++) {
        try {
            initialPos.push(...angles);
            // newStates[i].realDegrees = angles;
            const newStates = [...jointStates];
            for (let i = 0; i < newStates.length; i++) {
              if (typeof angles[i] === 'number') {
                // newStates[i].virtualDegrees = angles[i];
                newStates[i].realDegrees = angles[i];
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
            }
          
        } catch (error) {
          console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
          if (jointDetails[i].jointType === "revolute") {
            newStates[i].realDegrees = "error";
          }
        }
      }
      setInitialPositions(initialPos);
      setJointStates(newStates);
    } catch (error) {
      console.error("Failed to update feedback to the robot:", error);
    }
  }, [jointStates, jointDetails]);

  // Update revolute joint degrees
  const updateJointDegrees = useCallback(
    async (servoId: number, value: number) => {
      const newStates = [...jointStates];
      const jointIndex = newStates.findIndex(
        (state) => state.servoId === servoId
      ); // Find joint by servoId

      if (jointIndex !== -1) {
        newStates[jointIndex].virtualDegrees = value;

        if (isSerialConnected || isWebSocketConnected) {
          try {
            if (!Number.isNaN(value)) {
              if (isSerialConnected) {
                roarm.joint_angle_ctrl(servoId, value,0,0);
              }
              else if (isWebSocketConnected) {
                wsClient.joint_angle_ctrl([servoId, value]);
              }      
            }
          } catch (error) {
            console.error(
              `Failed to update servo degrees for joint with servoId ${servoId}:`,
              error
            );
            // Consider setting realDegrees to 'error' or keeping the last known value
            // newStates[jointIndex].realDegrees = 'error';
          }
        }
        setJointStates(newStates);
      }
    },
    [jointStates, isSerialConnected, isWebSocketConnected, initialPositions]
  );

  const updateJointsDegrees: UpdateJointsDegrees = useCallback(
    async (updates) => {
      const newStates = [...jointStates];

      updates.forEach(({ servoId, value }) => {
        const jointIndex = newStates.findIndex(
          (state) => state.servoId === servoId
        );
        if (jointIndex !== -1) {
          newStates[jointIndex].virtualDegrees = value;
        }
      });

      if (isSerialConnected || isWebSocketConnected) {
        const anglesArray: number[] = [];       

        jointDetails.forEach((joint) => {
          const jointIndex = newStates.findIndex(
              (state) => state.servoId === joint.servoId
            );
          if (jointIndex !== -1) {
            const virtual = newStates[jointIndex].virtualDegrees || 0;

            anglesArray.push(virtual);   

          } else {
            anglesArray.push(0);
          }
        });

        try {
          if (
            Array.isArray(anglesArray) && 
            anglesArray.length > 0 && 
            anglesArray.every(a => !isNaN(a))
          ) {
             if(isSerialConnected){
               roarm.joints_angle_ctrl(anglesArray, 0, 0);
             }
             else if(isWebSocketConnected){
               wsClient.joints_angle_ctrl(anglesArray);
             }
          }
        } catch (error) {
          console.error("Failed to update joint angles:", error);
        }
      }
      setJointStates(newStates);
    },
    [jointStates, isSerialConnected, isWebSocketConnected, initialPositions]
  );

  return {
    isSerialConnected,
    isWebSocketConnected,
    connectRobotBySerial,
    disconnectRobotBySerial,
    connectRobotByWebSocket,
    disconnectRobotByWebSocket,
    getfeedbackBySerial,
    getfeedbackByWebSocket,
    jointStates,
    updateJointDegrees,
    updateJointsDegrees,
    setJointDetails,
  };
}