"use client";
import Oeact, { useState, useEffect, useRef } from "react"; // Added useRef
import {
  JointState,
  CoordinateState,
  UpdateJointDegrees,
  UpdateJointsDegrees,
  UpdateCoordinates,
} from "../../../hooks/useRobotControl";
import { radiansToDegrees } from "../../../lib/utils";
import { RobotConfig } from "@/config/robotConfig";
import {  roarm_m2,roarm_m3 } from "@/config/roarmSolver"; 
import { StepBack } from "lucide-react";

type RevoluteJointsTableProps = {
  joints: JointState[];
  coordinates: CoordinateState[];
  updateJointDegrees: UpdateJointDegrees;
  updateJointsDegrees: UpdateJointsDegrees;
  updateCoordinates: UpdateCoordinates;
  keyboardControlMap: RobotConfig["keyboardControlMap"];
  CoordinateControls?: RobotConfig["CoordinateControls"]; // Use type from robotConfig
  isReverse: boolean;
  robotName: string;
};

// Define constants for interval and step size
const KEY_UPDATE_INTERVAL_MS = 3;
const KEY_UPDATE_STEP_DEGREES = 0.15;

const formatVirtualDegrees = (degrees?: number) =>
  degrees !== undefined
    ? `${degrees > 0 ? "+" : ""}${degrees.toFixed(1)}°`
    : "/";

const formatRealDegrees = (degrees?: number | "N/A" | "error") => {
  if (degrees === "error") {
    return <span className="text-red-500">Error</span>;
  }
  return degrees === "N/A" ? "/" : `${degrees?.toFixed(1)}°`;
};

const formatRealCoordinates = (coordinates?: number | "N/A" | "error") => {
  if (coordinates === "error") {
    return <span className="text-red-500">Error</span>;
  }
  return coordinates === "N/A" ? "/" : `${coordinates?.toFixed(1)}mm`;
};

const formatRealOrientations = (radians?: number | "N/A" | "error") => {
  if (radians === "error") {
    return <span className="text-red-500">Error</span>;
  }
  return radians === "N/A"
    ? "/"
    : `${(radians !== undefined ? (radians * 180) / Math.PI : 0).toFixed(1)}°`;
};


const formatVirtualCoordinates = (coordinates?: number) =>
  coordinates !== undefined
    ? `${coordinates > 0 ? "+" : ""}${coordinates.toFixed(1)}mm`
    : "/";

const formatVirtualOrientations = (radians?: number | "N/A" | "error") =>
  typeof radians === "number"
    ? `${radians > 0 ? "+" : ""}${(radians * 180 / Math.PI).toFixed(1)}°`
    : "/";

export function RevoluteJointsTable({
  joints,
  coordinates,
  updateJointDegrees,
  updateJointsDegrees,
  updateCoordinates,
  keyboardControlMap,
  CoordinateControls,
  isReverse,
  robotName,
}: RevoluteJointsTableProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  // Refs to hold the latest values needed inside the interval callback
  const jointsRef = useRef(joints);
  const coordinatesRef = useRef(coordinates);
  const updateJointsDegreesRef = useRef(updateJointsDegrees);
  const updateCoordinatessRef = useRef(updateCoordinates);
  const keyboardControlMapRef = useRef(keyboardControlMap);

  // Update refs whenever the props change
  useEffect(() => {
    jointsRef.current = joints;
    coordinatesRef.current = coordinates;
  }, [joints, coordinates]);

  useEffect(() => {
    updateJointsDegreesRef.current = updateJointsDegrees;
    updateCoordinatessRef.current = updateCoordinates;
  }, [updateJointsDegrees, updateCoordinates]);

  useEffect(() => {
    keyboardControlMapRef.current = keyboardControlMap;
  }, [keyboardControlMap]);

  // Effect for keyboard listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the pressed key is actually used for control to potentially prevent default
      // Note: Using the ref here ensures we check against the *latest* map
      const isControlKey = Object.values(keyboardControlMapRef.current || {})
        .flat()
        .includes(event.key);
      if (isControlKey) {
        // event.preventDefault(); // Optional: uncomment if keys like arrows scroll the page
      }
      setPressedKeys((prevKeys) => new Set(prevKeys).add(event.key));
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setPressedKeys((prevKeys) => {
        const newKeys = new Set(prevKeys);
        newKeys.delete(event.key);
        return newKeys;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []); // Empty dependency array: sets up listeners once

  // Effect for handling continuous updates when keys are pressed
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateJointsBasedOnKeys = () => {
      const currentJoints = jointsRef.current;
      const currentCoordinates = coordinatesRef.current;
      const currentControlMap = keyboardControlMapRef.current || {};
      const currentPressedKeys = pressedKeys;

      let currentpose = currentCoordinates.map(c => c.virtualCoordinates ?? 0);

      const currentCoordinateControls = CoordinateControls || [];

      let jointupdates: { servoId: number; value: number }[] = [];
      let hand_joint_rad = 0.0;
      let ikResults: number[] = [];
      let changepose = false;
      // ------------------------
      // 单独关节控制
      // ------------------------
      jointupdates = currentJoints
        .map((joint) => {
          const currentDegrees = joint.virtualDegrees || 0;
          const increaseKey = currentControlMap[joint.servoId!]?.[0];

          if (increaseKey && currentPressedKeys.has(increaseKey)) {
            let newValue = currentDegrees + (isReverse ? -KEY_UPDATE_STEP_DEGREES : KEY_UPDATE_STEP_DEGREES);
            const lowerLimit = radiansToDegrees(joint.limit?.lower ?? -Infinity);
            const upperLimit = radiansToDegrees(joint.limit?.upper ?? Infinity);
            newValue = Math.max(lowerLimit, Math.min(upperLimit, newValue));

            if (newValue !== currentDegrees) {
              return { servoId: joint.servoId!, value: newValue };
            }
          }
          return null;
        })
        .filter((u) => u !== null) as { servoId: number; value: number }[];

      // 坐标控制（XYZ控制）
      // ------------------------
      currentCoordinateControls.forEach((cm) => {
        if (!cm || !cm.name) return;
        else{        
          const keyPressed = currentPressedKeys.has(cm.keys[0]);
          if (!keyPressed) return;

          const position_delta = isReverse ? -0.2 : 0.2;
          const orientation_delta = isReverse ? -0.001 : 0.001;

          switch (cm.keys[0]) {
            case "x": // X轴控制
              currentpose[0] += position_delta;
              changepose = true;
              break;
            case "y": // Y轴控制
              currentpose[1] += position_delta;
              changepose = true;
              break;
            case "z": // Z轴控制
              currentpose[2] += position_delta;
              changepose = true;
              break;
            case "r": // roll控制
              currentpose[3] += orientation_delta;
              changepose = true;
              break;
            case "p": // pitch控制
              currentpose[4] += orientation_delta;
              changepose = true;
              break;
            default:
              break;
          }
        }
        // ------------------------
        // 坐标逆解控制关节
        // ------------------------
        if(changepose){
          if(robotName=="roarm_m2"){  
            ikResults = roarm_m2.computeJointRadbyPos(
              currentpose[0],
              currentpose[1],
              currentpose[2],
              hand_joint_rad
            );          
          changepose=false;
          }else if(robotName=="roarm_m3"){
            ikResults = roarm_m3.computeJointRadbyPos(
              currentpose[0],
              currentpose[1],
              currentpose[2],
              currentpose[3],
              currentpose[4],
              hand_joint_rad
            );       
          }
          changepose=false;
        }

      jointupdates = currentJoints
        .map((joint, idx) => {
          const deg = radiansToDegrees(ikResults[idx]);
          const lowerLimit = radiansToDegrees(joint.limit?.lower ?? -Infinity);
          const upperLimit = radiansToDegrees(joint.limit?.upper ?? Infinity);
          const value = Math.max(lowerLimit, Math.min(upperLimit, deg));
          if (Math.abs(value - (joint.virtualDegrees ?? 0)) > 1e-3) {
            return { servoId: joint.servoId!, value };
          }
          return null;
        })
        .filter((u) => u !== null) as { servoId: number; value: number }[];                
      });

      if (jointupdates.length > 0) {
        updateJointsDegreesRef.current(jointupdates);
      }
    };    
    if (pressedKeys.size > 0) {
      intervalId = setInterval(updateJointsBasedOnKeys, KEY_UPDATE_INTERVAL_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pressedKeys]);

  // Mouse handlers update the `pressedKeys` state, which triggers the interval effect
  const handleMouseDown = (key: string | undefined) => {
    if (key) {
      setPressedKeys((prevKeys) => new Set(prevKeys).add(key));
    }
  };

  const handleMouseUp = (key: string | undefined) => {
    if (key) {
      setPressedKeys((prevKeys) => {
        const newKeys = new Set(prevKeys);
        newKeys.delete(key);
        return newKeys;
      });
    }
  };

  // Component rendering uses the `joints` prop for display
  return (
    <div className="mt-4">
      <table className="table-auto w-full text-left text-sm">
        <thead>
          {/* ... existing table head ... */}
          <tr>
            <th className="border-b border-gray-600 pb-1 pr-2">Joint</th>
            <th className="border-b border-gray-600 pb-1 text-center pl-2">
              Virtual Angle
            </th>
            <th className="border-b border-gray-600 pb-1 text-center pl-2">
              Real Angle
            </th>
            <th className="border-b border-gray-600 pb-1 text-center px-2">
              Control
            </th>
          </tr>
        </thead>
        <tbody>
          {joints.map((detail) => {
            // Use `joints` prop for rendering current state
            const increaseKey = keyboardControlMap[detail.servoId!];
            const isDecreaseActive =
              isReverse && increaseKey && pressedKeys.has(increaseKey);
            const isIncreaseActive =
              !isReverse && increaseKey && pressedKeys.has(increaseKey);
            return (
              <tr key={detail.servoId}>
                <td className="">
                  {/* <span className="text-gray-600">{detail.servoId}</span>{" "} */}
                  {detail.name}
                </td>

                <td className="pr-2 text-center w-16">
                  {formatVirtualDegrees(detail.virtualDegrees)}
                </td>
                <td className="pl-2 text-center w-16">
                  {formatRealDegrees(detail.realDegrees)}
                </td>
                <td className="py-1 px-4 flex items-center">
                  <button
                    onMouseDown={() => handleMouseDown(increaseKey)}
                    onMouseUp={() => handleMouseUp(increaseKey)}
                    onMouseLeave={() => handleMouseUp(increaseKey)} // Optional: stop if mouse leaves button while pressed
                    onTouchStart={() => handleMouseDown(increaseKey)} // Optional: basic touch support
                    onTouchEnd={() => handleMouseUp(increaseKey)} // Optional: basic touch support
                    className={`${
                      isDecreaseActive
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    } text-white text-xs font-bold w-5 h-5 text-right pr-1 uppercase select-none`} // Added select-none
                    style={{
                      clipPath:
                        "polygon(0 50%, 30% 0, 100% 0, 100% 100%, 30% 100%)",
                    }}
                  >
                    {"-"}
                  </button>
                  <input
                    type="range"
                    min={Math.round(
                      radiansToDegrees(detail.limit?.lower ?? -Math.PI)
                    )}
                    max={Math.round(
                      radiansToDegrees(detail.limit?.upper ?? Math.PI)
                    )}
                    step="0.1"
                    value={detail.virtualDegrees || 0}
                    // Note: onChange is only triggered by user sliding the range input,
                    // not when the `value` prop changes programmatically (e.g., via button clicks).
                    onChange={(e) => {
                      const valueInDegrees = parseFloat(e.target.value);
                      updateJointDegrees(detail.servoId!, valueInDegrees);
                    }}
                    className="h-2 bg-gray-700 appearance-none cursor-pointer w-14 custom-range-thumb"
                  />
                  <button
                    onMouseDown={() => handleMouseDown(increaseKey)}
                    onMouseUp={() => handleMouseUp(increaseKey)}
                    onMouseLeave={() => handleMouseUp(increaseKey)} // Optional
                    onTouchStart={() => handleMouseDown(increaseKey)} // Optional
                    onTouchEnd={() => handleMouseUp(increaseKey)} // Optional
                    className={`${
                      isIncreaseActive
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    } text-white text-xs font-semibold w-5 h-5 text-left pl-1 uppercase select-none`} // Added select-none
                    style={{
                      clipPath:
                        "polygon(100% 50%, 70% 0, 0 0, 0 100%, 70% 100%)",
                    }}
                  >
                    {increaseKey || "+"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Display CoordinateControls if present */}
      {CoordinateControls && CoordinateControls.length > 0 && (
        <div className="mt-4">
          <table className="table-auto w-full text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-600 pb-2 pr-2">
                  Coordinate
                </th>
                <th className="border-b border-gray-600 pb-1 text-center pl-2">
                  Virtual Coordinate
                </th>
                <th className="border-b border-gray-600 pb-1 text-center pl-2">
                  Real Coordinate
                </th>
                <th className="border-b border-gray-600 pb-1 text-center pl-2">
                  Control
                </th>                
              </tr>
            </thead>
            <tbody>
              {CoordinateControls.map((cm, idx) => {
                const increaseKey = cm.keys;
                const coord = coordinates.find(c => c.name === cm.name);
                const isDecreaseActive =
                  isReverse && increaseKey && pressedKeys.has(increaseKey);
                const isIncreaseActive =
                  !isReverse && increaseKey && pressedKeys.has(increaseKey);

                return (
                  <tr key={idx}>
                    <td  className="">{cm.name}</td>
                    <td className="pr-2 text-center w-16">
                    {idx <= 2
                      ? formatVirtualCoordinates(coord?.virtualCoordinates) 
                      : formatVirtualOrientations(coord?.virtualCoordinates)} 
                    </td>
                    <td className="pl-2 text-center w-16">
                    {idx <= 2
                      ? formatRealCoordinates(coord?.realCoordinates) 
                      : formatRealOrientations(coord?.realCoordinates)} 
                    </td>                    
                    <td className="py-1 px-4 flex items-center">
                      <span className="space-x-1 flex flex-row">
                        {/* Decrease key */}
                        <button
                          onMouseDown={() => handleMouseDown(increaseKey)}
                          onMouseUp={() => handleMouseUp(increaseKey)}
                          onMouseLeave={() => handleMouseUp(increaseKey)}
                          onTouchStart={() => handleMouseDown(increaseKey)}
                          onTouchEnd={() => handleMouseUp(increaseKey)}
                          className={`${
                            isDecreaseActive
                              ? "bg-blue-600"
                              : "bg-gray-700 hover:bg-gray-600"
                          } text-white text-xs font-bold w-5 h-5 text-right pr-1 uppercase select-none`}
                          style={{
                            clipPath:
                              "polygon(0 50%, 30% 0, 100% 0, 100% 100%, 30% 100%)",
                            minWidth: "1.8em",
                            minHeight: "1.8em",
                            fontWeight: 600,
                            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
                          }}
                          tabIndex={-1}
                        >
                          {"-"}
                        </button>
                        {/* Increase key */}
                        <button
                          onMouseDown={() => handleMouseDown(increaseKey)}
                          onMouseUp={() => handleMouseUp(increaseKey)}
                          onMouseLeave={() => handleMouseUp(increaseKey)}
                          onTouchStart={() => handleMouseDown(increaseKey)}
                          onTouchEnd={() => handleMouseUp(increaseKey)}
                          className={`${
                            isIncreaseActive
                              ? "bg-blue-600"
                              : "bg-gray-700 hover:bg-gray-600"
                          } text-white text-xs font-semibold w-5 h-5 text-left pl-1 uppercase select-none`}
                          style={{
                            clipPath:
                              "polygon(100% 50%, 70% 0, 0 0, 0 100%, 70% 100%)",
                            minWidth: "1.8em",
                            minHeight: "1.8em",
                            fontWeight: 600,
                            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
                          }}
                          tabIndex={-1}
                        >
                          {increaseKey || "+"}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style jsx global>{`
        .custom-range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .custom-range-thumb::-moz-range-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .custom-range-thumb::-ms-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .custom-range-thumb {
          /* Remove default styles for Firefox */
          overflow: hidden;
        }
        input[type="range"].custom-range-thumb {
          /* Remove default focus outline for Chrome */
          outline: none;
        }
      `}</style>
    </div>
  );
}
