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
) {
  const [isSerialConnected, setIsSerialConnected, ] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [jointDetails, setJointDetails] = useState(initialJointDetails);
  const wsClient = useWebSocketClient();
  const roarmRef = useRef<Roarm | null>(null);


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
  const connectRobot = useCallback(async (options: { roarm?: Roarm; url?: string }) => {
    try {
      const { roarm, url } = options;
      const newStates = [...jointStates];
      let angles: number[] = [];
      if(roarm && (!url || url.trim() === "")){
        roarmRef.current = roarm;
        await roarmRef.current.connect();
        setIsSerialConnected(true);
        roarmRef.current.torque_set(1);
        angles = await roarmRef.current.joints_angle_get()
        console.log("Robot connected by serial successfully.");
      }else if(!roarm && url && url.trim() !== ""){
        await wsClient.connect(url);
        setIsWebSocketConnected(true);
        wsClient.torque_set(1);
        angles = await wsClient.joints_angle_get()
        console.log("Robot connected by websocket successfully.");
      }

      for (let i = 0; i < jointDetails.length; i++) {
        try {
          if (typeof angles[i] === 'number') {
            newStates[i].virtualDegrees = angles[i];
            newStates[i].realDegrees = angles[i];
          }
        } catch (error) {
          console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
          newStates[i].realDegrees = "error";
        }
      }
      setJointStates(newStates);  
    } catch (error) {
      console.error("Failed to connect to the robot:", error);
    }
  }, [jointStates, jointDetails]);

  const TorqueSet = useCallback((cmd:number) => {
    try {
      if (isSerialConnected) {
        roarmRef.current.torque_set(cmd);
      }else if (isWebSocketConnected) {
        wsClient.torque_set(cmd);
      }  
    }
    catch (error) {
        console.error("Failed to set torque to the robot:", error);
      }        
  }, [jointStates, jointDetails]);

  const updateAngles = useCallback(async (type:string) => {
    try {
      const newStates = [...jointStates];
      let angles: number[] = [];

      if (isSerialConnected) {
        angles = await roarmRef.current.joints_angle_get();
      }else if (isWebSocketConnected) {
        angles = await wsClient.joints_angle_get();
      } 
      // angles = [0,0,0,0,0,0]; // Mock angles for testing
        for (let i = 0; i < jointDetails.length; i++) {
          try {
              if (typeof angles[i] === 'number') {
                switch(type) {
                  case "Real":
                    newStates[i].realDegrees = angles[i];
                    break;
                  case "Virtual":
                    newStates[i].virtualDegrees = angles[i];
                    newStates[i].realDegrees = angles[i];
                    break;
                }
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
          } catch (error) {
            console.error(`Failed to initialize joint ${jointDetails[i].servoId}:`, error);
            newStates[i].realDegrees = "error";
          }
        }
        setJointStates(newStates);
      } 
    catch (error) {
        console.error("Failed to update feedback to the robot:", error);
      }        
  }, [jointStates, jointDetails]);

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
          wsClient.disconnect(); // 如果这是异步的建议加 await
          setIsWebSocketConnected(false);
        } catch (err) {
          console.error("WebSocket disconnect or torque set failed:", err);
        }
      } else {
        console.warn("No robot connection found to disconnect.");
      }

      // 清空 joint 状态
      setJointStates((prevStates) =>
        prevStates.map((state) =>
          state.jointType === "revolute"
            ? { ...state, realDegrees: "N/A" }
            : { ...state, realSpeed: "N/A" }
        )
      );

      console.log("Robot disconnected successfully.");
    } catch (error) {
      console.error("Failed to disconnect from the robot:", error);
    }
  }, [isSerialConnected, isWebSocketConnected]);

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
                roarmRef.current.joint_angle_ctrl(servoId, value,0,0);
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
    [jointStates, isSerialConnected, isWebSocketConnected]
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
               roarmRef.current.joints_angle_ctrl(anglesArray, 0, 0);
             }else if(isWebSocketConnected){
               wsClient.joints_angle_ctrl(anglesArray);
             }
          }
        } catch (error) {
          console.error("Failed to update joint angles:", error);
        }
      }
      setJointStates(newStates);
    },
    [jointStates, isSerialConnected, isWebSocketConnected]
  );

  return {
    isSerialConnected,
    isWebSocketConnected,
    jointStates,
    connectRobot,
    TorqueSet,
    updateAngles,
    disconnectRobot,
    updateJointDegrees,
    updateJointsDegrees,
    setJointDetails,
  };
}