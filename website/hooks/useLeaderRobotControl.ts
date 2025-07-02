import { useState, useCallback, useRef, useEffect} from "react";
import { nan, number } from "zod";
import { Roarm } from "roarm-sdk";
import { useWebSocketClient } from "@/hooks/useWebSocketClient"; 
import { json } from "stream/consumers";

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

export type UpdateCoordinates = (
  updates: { axisId: number; value: number }[]
) => Promise<void>;

export function useLeaderRobotControl(  
) {
  const [isSerialConnected, setIsSerialConnected, ] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const wsClient = useWebSocketClient();
  const roarmRef = useRef<Roarm | null>(null);

  // Connect to leader robot
  const connectRobot = useCallback(async (options: { roarm?: Roarm; url?: string }) => {
    try {
      const { roarm, url } = options;
      let angles: number[] = [];
      if(roarm && (!url || url.trim() === "")){
        roarmRef.current = roarm;
        await roarmRef.current.connect();
        setIsSerialConnected(true);
        roarmRef.current.torque_set(0);
        angles = await roarmRef.current.joints_angle_get()
        console.log("Robot connected by serial successfully.");
      }else if(!roarm && url && url.trim() !== ""){
        await wsClient.connect(url);
        setIsWebSocketConnected(true);
        wsClient.torque_set(0);
        angles = await wsClient.joints_angle_get()
        console.log("Robot connected by websocket successfully.");
      }
 
      } catch (error) {
      console.error("Failed to connect to the robot:", error);
    }
  }, []);

  // Disconnect from the robot
  const disconnectRobot = useCallback(async () => {
    try {
      if (isSerialConnected && roarmRef.current) {
        console.log("Disconnecting robot via Serial...");
        try {
          roarmRef.current.torque_set(0);
          await roarmRef.current.disconnect();
          setIsSerialConnected(false);
        } catch (err) {
          console.error("Serial disconnect or torque set failed:", err);
        }
      } else if (isWebSocketConnected) {
        console.log("Disconnecting robot via WebSocket...");
        try {
          wsClient.torque_set(0);
          wsClient.disconnect(); 
          setIsWebSocketConnected(false);
        } catch (err) {
          console.error("WebSocket disconnect or torque set failed:", err);
        }
      } else {
        console.warn("No robot connection found to disconnect.");
      }

      console.log("Robot disconnected successfully.");
    } catch (error) {
      console.error("Failed to disconnect from the robot:", error);
    }
  }, [isSerialConnected, isWebSocketConnected]);

const getAngles = useCallback(async ()=> {
  try {
    if (isSerialConnected && roarmRef.current) {
      return await roarmRef.current.joints_angle_get();
    } else if (isWebSocketConnected) {
      const angles = await wsClient.joints_angle_get();
      return angles;
    }
  } catch (error) {
    console.error("Failed to get joint angles:", error);
  }
}, [isSerialConnected, isWebSocketConnected]);

  return {
    isSerialConnected,
    isWebSocketConnected,
    connectRobot,
    disconnectRobot,
    getAngles,
  };
}
