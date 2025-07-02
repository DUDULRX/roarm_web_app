/**
 * Control virtual degree with this hook, the real degree is auto managed
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { nan } from "zod";
import { Roarm } from "roarm-sdk";
import { useWebSocketClient } from "@/hooks/useWebSocketClient"; 
import { json } from "stream/consumers";
import { degreesToRadians } from "../lib/utils";
import { roarm_m2,roarm_m3 } from "@/config/roarmSolver"; 
import { RECORDING_INTERVAL } from "@/config/uiConfig";

export function updateVirtualCoordinatesByVirtualJointStates(
  jointsRef: React.MutableRefObject<JointState[]>,
  updatedServoId: number,
  updatedValue: number,
  robotName: string,
  updateCoordinates: UpdateCoordinates
) {
  const getDegree = (id: number): number => {
    const joint = jointsRef.current.find((j) => j.servoId === id);
    return joint?.servoId === updatedServoId
      ? updatedValue
      : joint?.virtualDegrees ?? 0;
  };

  let pose: number[] = [];

  if (robotName === "roarm_m2") {
    pose = roarm_m2.computePosbyJointRad(
      degreesToRadians(getDegree(1)),
      degreesToRadians(getDegree(2)),
      degreesToRadians(getDegree(3)),
      degreesToRadians(getDegree(4))
    );
  } else if (robotName === "roarm_m3") {
    pose = roarm_m3.computePosbyJointRad(
      degreesToRadians(getDegree(1)),
      degreesToRadians(getDegree(2)),
      degreesToRadians(getDegree(3)),
      degreesToRadians(getDegree(4)),
      degreesToRadians(getDegree(5)),
      degreesToRadians(getDegree(6))
    );
  }

  const coordinateupdates = pose.map((val, idx) => ({
    axisId: idx,
    value: val,
  }));
  updateCoordinates(coordinateupdates);
}

export function updateRealCoordinatesByRealDegrees(
  joints: JointState[],
  robotName: string,
  updateCoordinates: UpdateCoordinates
) {
joints.forEach((j) => {
  console.log(`Joint ${j.servoId}: real=${j.realDegrees}, virtual=${j.virtualDegrees}`);
});

  const valid = joints.every(j => typeof j.realDegrees === 'number' && !isNaN(j.realDegrees));
  if (!valid) {
    console.warn("Invalid realDegrees detected, skipping coordinate update");
    return;
  }

  const getRealDegree = (id: number): number => {
    const joint = joints.find((j) => j.servoId === id);
    return typeof joint?.realDegrees === "number" ? joint.realDegrees : 0;
  };

  let pose: number[] = [];

  try {
    if (robotName === "roarm_m2") {
      pose = roarm_m2.computePosbyJointRad(
        degreesToRadians(getRealDegree(1)),
        degreesToRadians(getRealDegree(2)),
        degreesToRadians(getRealDegree(3)),
        degreesToRadians(getRealDegree(4))
      );
    } else if (robotName === "roarm_m3") {
      pose = roarm_m3.computePosbyJointRad(
        degreesToRadians(getRealDegree(1)),
        degreesToRadians(getRealDegree(2)),
        degreesToRadians(getRealDegree(3)),
        degreesToRadians(getRealDegree(4)),
        degreesToRadians(getRealDegree(5)),
        degreesToRadians(getRealDegree(6))
      );
    }
  } catch(e) {
    console.error("Error computing pose:", e);
    return;
  }

  const updates = pose.map((val, idx) => ({
    axisId: idx,
    value: val,
  }));

  updateCoordinates(updates);
}

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

type CoordinateDetails = {
  name: string;
  axisId: number;
};

export type CoordinateState = {
  name: string;
  axisId: number;
  virtualCoordinates?: number;
  realCoordinates?: number | "N/A" | "error";
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

export type UpdateCoordinates = (
  updates: { axisId: number; value: number }[]
) => Promise<void>;

export type RecordData = number[][]; 

export function useRobotControl(
  initialJointDetails: JointDetails[],
  initialCoordinateDetails: CoordinateDetails[],
  robotName: string,
) {
  const [isSerialConnected, setIsSerialConnected, ] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [jointDetails, setJointDetails] = useState(initialJointDetails);
  const [coordinateDetails, setCoordinateDetails] = useState(initialCoordinateDetails);
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordData, setRecordData] = useState<RecordData>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const [coordinateStates, setCoordinateStates] = useState<CoordinateState[]>(
    coordinateDetails.map((j, index) => ({
      virtualCoordinates: 0 ,
      realCoordinates:  "N/A",
      axisId: j.axisId, // Assign servoId based on index
      name: j.name, // Map name from JointDetails
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
                    newStates[i].realDegrees = angles[i];
                    newStates[i].virtualDegrees = angles[i];
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

  const UpdateCoordinates: UpdateCoordinates = useCallback(
    async (updates) => {
      setCoordinateStates((prevStates) => {
        const newStates = [...prevStates];
        updates.forEach(({ axisId, value }) => {
          if (typeof axisId !== 'number') return;
          const jointIndex = newStates.findIndex(
            (state) => state.axisId === axisId
          );
          if (jointIndex !== -1) {
            newStates[jointIndex].virtualCoordinates = value;
          }
        });
        return newStates;
      });
    },
    [] 
  );

  const UpdateRealCoordinates: UpdateCoordinates = useCallback(
    async (updates) => {
      setCoordinateStates((prevStates) => {
        const newStates = [...prevStates];
        updates.forEach(({ axisId, value }) => {
          if (typeof axisId !== 'number') return;
          const coordIndex = newStates.findIndex(
            (state) => state.axisId === axisId
          );
          if (coordIndex !== -1) {
            newStates[coordIndex].realCoordinates = value;
          }
        });
        return newStates;
      });
    },
    []
  );

  const updateCoordinatessRef = useRef<UpdateCoordinates>(() => Promise.resolve());

  useEffect(() => {
    updateCoordinatessRef.current = UpdateCoordinates;
  }, [UpdateCoordinates]);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordData([]);

    recordingIntervalRef.current = setInterval(() => {
      const currentFrame: number[] = [];

      jointDetails.forEach((joint) => {
        const jointState = jointStates.find(
          (state) => state.servoId === joint.servoId
        );
        if (jointState) {
          if (joint.jointType === "revolute") {
            currentFrame.push(jointState.virtualDegrees ?? 0);
          } 
        } else {
          currentFrame.push(0);
        }
      });

      setRecordData((prev) => [...prev, currentFrame]);
    }, RECORDING_INTERVAL);
  }, [jointDetails, jointStates]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const clearRecordData = useCallback(() => {
    setRecordData([]);
  }, []);

  // Clean up recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
  const allRevoluteHaveVirtual = jointStates.every(
    (j) =>
      j.jointType !== "revolute" ||
      (typeof j.virtualDegrees === "number" && !isNaN(j.virtualDegrees))
  );

  if (allRevoluteHaveVirtual) {
    updateVirtualCoordinatesByVirtualJointStates(
      { current: jointStates },
      -1,
      0,
      robotName,
      UpdateCoordinates
    );
  }
}, [jointStates, robotName, UpdateCoordinates]);

  useEffect(() => {
  const allRevoluteHaveValue = jointStates.every(
    (j) =>
      j.jointType !== "revolute" ||
      (typeof j.realDegrees === "number" && !isNaN(j.realDegrees))
  );

  if (allRevoluteHaveValue) {
    updateRealCoordinatesByRealDegrees(jointStates, robotName, UpdateRealCoordinates);
  }
}, [jointStates, robotName, UpdateRealCoordinates]);


  return {
    isSerialConnected,
    isWebSocketConnected,
    jointStates,
    coordinateStates,
    connectRobot,
    TorqueSet,
    updateAngles,
    disconnectRobot,
    updateJointDegrees,
    updateJointsDegrees,
    UpdateCoordinates,
    UpdateRealCoordinates,
    setJointDetails,
    setCoordinateDetails,
    isRecording,
    recordData,
    startRecording,
    stopRecording,
    clearRecordData,
  };
}