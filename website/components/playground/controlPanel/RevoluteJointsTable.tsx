"use client";
import Oeact, { useState, useEffect, useRef } from "react"; // Added useRef
import {
  JointState,
  UpdateJointDegrees,
  UpdateJointsDegrees,
} from "../../../hooks/useRobotControl";
import { radiansToDegrees,degreesToRadians } from "../../../lib/utils";
import { RobotConfig } from "@/config/robotConfig";
import { roarm_m3 } from "@/config/roarm_solver"; 
import { StepBack } from "lucide-react";

type RevoluteJointsTableProps = {
  joints: JointState[];
  updateJointDegrees: UpdateJointDegrees;
  updateJointsDegrees: UpdateJointsDegrees;
  keyboardControlMap: RobotConfig["keyboardControlMap"];
  compoundMovements?: RobotConfig["compoundMovements"]; // Use type from robotConfig
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

export function RevoluteJointsTable({
  joints,
  updateJointDegrees,
  updateJointsDegrees,
  keyboardControlMap,
  compoundMovements,
}: RevoluteJointsTableProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  // Refs to hold the latest values needed inside the interval callback
  const jointsRef = useRef(joints);
  const updateJointsDegreesRef = useRef(updateJointsDegrees);
  const keyboardControlMapRef = useRef(keyboardControlMap);
  const [pose, setPose] = useState([200, 0, 50]); // Initial pose

  // Update refs whenever the props change
  useEffect(() => {
    jointsRef.current = joints;
  }, [joints]);

  useEffect(() => {
    updateJointsDegreesRef.current = updateJointsDegrees;
  }, [updateJointsDegrees]);

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

  const currPoseRef = { current: [200, 0, 50] }; 
  // Effect for handling continuous updates when keys are pressed
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateJointsBasedOnKeys = () => {
      const currentJoints = jointsRef.current;
      const currentControlMap = keyboardControlMapRef.current || {};
      const currentPressedKeys = pressedKeys;
      const currentCompoundMovements = compoundMovements || [];

      let updates: { servoId: number; value: number }[] = [];

      // ------------------------
      // 单独关节控制
      // ------------------------
      updates = currentJoints
        .map((joint) => {
          const currentDegrees = joint.virtualDegrees || 0;
          const increaseKey = currentControlMap[joint.servoId!]?.[0];
          const isReverse = currentPressedKeys.has("r");

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

      const updatesMap = new Map<number, number>();
      updates.forEach((u) => updatesMap.set(u.servoId, u.value));

      const getDegree = (id: number): number => {
        if (updatesMap.has(id)) return updatesMap.get(id)!;
        const joint = currentJoints.find((j) => j.servoId === id);
        return joint?.virtualDegrees ?? 0;
      };

      const base_joint_rad = degreesToRadians(getDegree(1));
      const shoulder_joint_rad = degreesToRadians(getDegree(2));
      const elbow_joint_rad = degreesToRadians(getDegree(3));
      const wrist_joint_rad = degreesToRadians(getDegree(4));
      const roll_joint_rad = degreesToRadians(getDegree(5));
      const hand_joint_rad = degreesToRadians(getDegree(6));

      // 更新全局位姿
      currPoseRef.current = roarm_m3.computePosbyJointRad(
        base_joint_rad,
        shoulder_joint_rad,
        elbow_joint_rad,
        wrist_joint_rad,
        roll_joint_rad,
        hand_joint_rad
      );

      // ------------------------
      // 坐标控制（XYZ控制）
      // ------------------------
      let nextPose = [...currPoseRef.current];
      let poseChanged = false;

      currentCompoundMovements.forEach((cm) => {
        if (!cm || !cm.name) return;
        if (cm.name.includes("X") || cm.name.includes("Y") || cm.name.includes("Z")) {
          const keyPressed = currentPressedKeys.has(cm.keys[0]);
          const isReverse = currentPressedKeys.has("r");
          if (!keyPressed) return;

          const delta = isReverse ? -0.2 : 0.2;

          if (cm.name.includes("X")) {
            nextPose[0] += delta;
            poseChanged = true;
          } else if (cm.name.includes("Y")) {
            nextPose[1] += delta;
            poseChanged = true;
          } else if (cm.name.includes("Z")) {
            nextPose[2] += delta;
            poseChanged = true;
          }
        }
      });

      if (poseChanged) {
        setPose(nextPose);
      }

      // ------------------------
      // 坐标逆解控制关节
      // ------------------------
      const ikResults = roarm_m3.computeJointRadbyPos(
        nextPose[0],
        nextPose[1],
        nextPose[2],
        currPoseRef.current[3],
        currPoseRef.current[4]
      );

      const ikUpdates = currentJoints
        .map((joint, idx) => {
          const hasIk = idx < ikResults.length;
          const targetRad = hasIk
            ? ikResults[idx]
            : degreesToRadians(joint.virtualDegrees ?? 0); // 保留原角度

          const deg = radiansToDegrees(targetRad);
          const lowerLimit = radiansToDegrees(joint.limit?.lower ?? -Infinity);
          const upperLimit = radiansToDegrees(joint.limit?.upper ?? Infinity);
          const value = Math.max(lowerLimit, Math.min(upperLimit, deg));

          if (Math.abs(value - (joint.virtualDegrees ?? 0)) > 1e-3) {
            return { servoId: joint.servoId!, value };
          }
          return null;
        })
        .filter(Boolean) as { servoId: number; value: number }[];

      if (ikUpdates.length > 0) {
        updateJointsDegreesRef.current(ikUpdates);
      } else if (updates.length > 0) {
        updateJointsDegreesRef.current(updates); // 单独关节更新
      }
    };

    if (pressedKeys.size > 0) {
      intervalId = setInterval(updateJointsBasedOnKeys, KEY_UPDATE_INTERVAL_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pressedKeys, pose]);

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
              Angle
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
            const decreaseKey = keyboardControlMap[detail.servoId!]?.[1];
            const increaseKey = keyboardControlMap[detail.servoId!]?.[0];
            const isDecreaseActive =
              decreaseKey && pressedKeys.has(decreaseKey);
            const isIncreaseActive =
              increaseKey && pressedKeys.has(increaseKey);

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
                    onMouseDown={() => handleMouseDown(decreaseKey)}
                    onMouseUp={() => handleMouseUp(decreaseKey)}
                    onMouseLeave={() => handleMouseUp(decreaseKey)} // Optional: stop if mouse leaves button while pressed
                    onTouchStart={() => handleMouseDown(decreaseKey)} // Optional: basic touch support
                    onTouchEnd={() => handleMouseUp(decreaseKey)} // Optional: basic touch support
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
                    {decreaseKey || "-"}
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
      {/* Display compoundMovements if present */}
      {compoundMovements && compoundMovements.length > 0 && (
        <div className="mt-4">
          <div className="font-bold mb-2">Compound Movements</div>
          <table className="table-auto w-full text-left text-sm">
            <tbody>
              {compoundMovements.map((cm, idx) => {
                const decreaseKey = cm.keys[1];
                const increaseKey = cm.keys[0];
                const isDecreaseActive =
                  decreaseKey && pressedKeys.has(decreaseKey);
                const isIncreaseActive =
                  increaseKey && pressedKeys.has(increaseKey);
                return (
                  <tr key={idx}>
                    <td className="font-semibold pr-2 align-top">{cm.name}</td>
                    <td>
                      {cm.keys && cm.keys.length > 0 && (
                        <span className="space-x-1 flex flex-row">
                          {/* Decrease key */}
                          <button
                            onMouseDown={() => handleMouseDown(decreaseKey)}
                            onMouseUp={() => handleMouseUp(decreaseKey)}
                            onMouseLeave={() => handleMouseUp(decreaseKey)}
                            onTouchStart={() => handleMouseDown(decreaseKey)}
                            onTouchEnd={() => handleMouseUp(decreaseKey)}
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
                            {decreaseKey || "-"}
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
                      )}
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