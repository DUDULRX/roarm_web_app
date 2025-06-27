/**
 * Control virtual degree with this hook, the real degree is auto managed
 */

import { useState, useCallback, useEffect } from "react";
import { nan } from "zod";
import { Roarm } from "roarm-sdk";

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
  roarm: Roarm | null
) {
  const [isConnected, setIsConnected] = useState(false);
  const [jointDetails, setJointDetails] = useState(initialJointDetails);

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
  const connectRobot = useCallback(async () => {
    try {
      await roarm.connect();
      setIsConnected(true);
      console.log("Robot connected successfully.");
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
                newStates[i].realDegrees = angles[i];
              } else {
                newStates[i].realDegrees = "N/A"; 
              }
            }
            // Enable torque for revolute servos
            roarm.torque_set(1);
          
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
  const disconnectRobot = useCallback(async () => {
    try {
      // Disable torque for revolute servos and set wheel speed to 0 for continuous servos
      for (let i = 0; i < jointDetails.length; i++) {
        try {
          roarm.torque_set(0);
        } catch (error) {
          console.error(
            `Failed to reset joint ${jointDetails[i].servoId} during disconnect:`,
            error
          );
        }
      }

      await roarm.disconnect();
      setIsConnected(false);
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

  const getfeedback = useCallback(async () => {
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

        if (isConnected) {
          try {
            if (!Number.isNaN(value)) {
              roarm.joint_angle_ctrl(servoId,Math.round(value),0,0);
              // const angles = await roarm.joints_angle_get()
              // newStates[jointIndex].realDegrees = angles[jointIndex]; // Update relative realDegrees
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
    [jointStates, isConnected, initialPositions]
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

      if (isConnected) {
        const anglesArray: number[] = [];
        // const angles = await roarm.joints_angle_get()

        jointDetails.forEach((joint) => {
          const jointIndex = newStates.findIndex(
              (state) => state.servoId === joint.servoId
            );
          if (jointIndex !== -1) {
            const virtual = newStates[jointIndex].virtualDegrees || 0;

            anglesArray.push(Math.round(virtual));
            // newStates[jointIndex].realDegrees = angles[jointIndex];       

          } else {
            anglesArray.push(0);
          }
        });
        console.log("anglesArray", anglesArray);

        try {
          if (
            Array.isArray(anglesArray) && 
            anglesArray.length > 0 && 
            anglesArray.every(a => !isNaN(a))
          ) {
            roarm.joints_angle_ctrl(anglesArray, 0, 0);
          }
        } catch (error) {
          console.error("批量更新舵机角度失败:", error);
        }
      }

      setJointStates(newStates);
    },
    [jointStates, isConnected, initialPositions]
  );

  return {
    isConnected,
    connectRobot,
    disconnectRobot,
    getfeedback,
    jointStates,
    updateJointDegrees,
    updateJointsDegrees,
    setJointDetails,
  };
}