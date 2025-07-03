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
import { Axis, Button } from "@/config/robotConfig";

type RevoluteJointsTableProps = {
  joints: JointState[];
  coordinates: CoordinateState[];
  updateJointDegrees: UpdateJointDegrees;
  updateJointsDegrees: UpdateJointsDegrees;
  updateCoordinates: UpdateCoordinates;
  keyboardControlMap: RobotConfig["keyboardControlMap"];
  gamepadControlMap: RobotConfig["gamepadControlMap"]; // New prop for gamepad control
  CoordinateControls?: RobotConfig["CoordinateControls"]; // Use type from robotConfig
  isReverse: boolean;
  robotName: string;
};

// Define constants for interval and step size
const KEY_UPDATE_INTERVAL_MS = 3;
const KEY_UPDATE_STEP_DEGREES = 0.15;

const formatValue = (
  value?: number | "N/A" | "error",
  unit = "",
  isAngle = false,
  isVirtual = false
) => {
  if (value === "error") return <span className="text-red-500">Error</span>;
  if (value === "N/A") return "/";
  if (typeof value === "number") {
    let displayValue = value;
    if (isAngle) displayValue = (value * 180) / Math.PI;
    let prefix = isVirtual && value > 0 ? "+" : "";
    return `${prefix}${displayValue.toFixed(1)}${unit}`;
  }
  return "/";
};

export function RevoluteJointsTable({
  joints,
  coordinates,
  updateJointDegrees,
  updateJointsDegrees,
  updateCoordinates,
  keyboardControlMap,
  gamepadControlMap,
  CoordinateControls,
  isReverse,
  robotName,
}: RevoluteJointsTableProps) {
  const [pressedKeysKeyboard, setPressedKeysKeyboard] = useState<Set<string>>(new Set());
  const [pressedKeysGamepad, setPressedKeysGamepad] = useState<Set<string>>(new Set());
  const [activeInputDevice, setActiveInputDevice] = useState<"keyboard" | "gamepad">("keyboard");

  // Refs to hold the latest values needed inside the interval callback
  const jointsRef = useRef(joints);
  const coordinatesRef = useRef(coordinates);
  const updateJointsDegreesRef = useRef(updateJointsDegrees);
  const updateCoordinatesRef = useRef(updateCoordinates);
  const keyboardControlMapRef = useRef(keyboardControlMap);
  
  // Update refs whenever the props change
  useEffect(() => {
    jointsRef.current = joints;
    coordinatesRef.current = coordinates;
  }, [joints, coordinates]);

  useEffect(() => {
    updateJointsDegreesRef.current = updateJointsDegrees;
    updateCoordinatesRef.current = updateCoordinates;
  }, [updateJointsDegrees, updateCoordinates]);

  useEffect(() => {
    keyboardControlMapRef.current = keyboardControlMap;
  }, [keyboardControlMap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKeysKeyboard(prev => {
        if (!prev.has(e.key)) {
          setActiveInputDevice("keyboard"); 
          return new Set(prev).add(e.key);
        }
        return prev;
      });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeysKeyboard(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Effect for gamepad listeners
  useEffect(() => {
    let afId: number;
    const AXIS_THRESHOLD = 0.5;

    const pollGamepad = () => {
      const gp = navigator.getGamepads?.()[0];
      if (gp) {
        const newKeys = new Set<string>();

        const switchButtons = Object.keys(gamepadControlMap?.swith_control?.button || {});
        const switchButtonIndex = switchButtons.length > 0 ? Number(switchButtons[0]) : -1;
        const switchControlPressed = switchButtonIndex >= 0 && gp.buttons[switchButtonIndex]?.pressed;

        const mode = switchControlPressed ? "coordinates" : "joints";
        const map = gamepadControlMap?.[mode] || { axis: {}, button: {}, reversedKeys: [] };
        const r2 = gp.buttons[Button.RIGHT_BUMPER_2]?.pressed;
        const l3 = gp.buttons[Button.RIGHT_STICK_CLICK]?.pressed;

        for (const axisIndexStr in map.axis) {
          const axisIndex = Number(axisIndexStr) as Axis; 
          const keyName = map.axis[axisIndex];
          const axisValue = gp.axes[axisIndex];

          if (!keyName) continue;

          const isReversed = map.reversedKeys?.includes(keyName);  
          const pos = isReversed ? "-" : "+";
          const neg = isReversed ? "+" : "-";

          if (axisValue < -AXIS_THRESHOLD) {
            newKeys.add(keyName + pos);
          } else if (axisValue > AXIS_THRESHOLD) {
            newKeys.add(keyName + neg);
          }
        }

        for (const buttonIndexStr in map.button) {
          const buttonIndex = Number(buttonIndexStr) as Button;
          const keyName = map.button[buttonIndex];
          const isPressed = gp.buttons[buttonIndex]?.pressed;

          if (!keyName) continue;

          if (buttonIndex === Button.RIGHT_STICK_CLICK) {
            if (l3 && r2) newKeys.add(keyName + "-");
            else if (l3) newKeys.add(keyName + "+");
          } else if (isPressed) {
            newKeys.add(keyName);
          }
        }
        if (newKeys.size > 0) {
          setActiveInputDevice("gamepad"); 
        }
        setPressedKeysGamepad(newKeys);
      }

      afId = requestAnimationFrame(pollGamepad);
    };

    afId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(afId);
  }, [gamepadControlMap]);

  const activePressedKeys = activeInputDevice === "gamepad" ? pressedKeysGamepad : pressedKeysKeyboard;

  // Effect for handling continuous updates when keys are pressed
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateJointsBasedOnKeys = () => {
      const currentJoints = jointsRef.current;
      const currentCoordinates = coordinatesRef.current;
      const currentControlMap = keyboardControlMapRef.current || {};
      // const currentPressedKeys = pressedKeys;
      const currentPressedKeys = activePressedKeys;

      let currentpose = currentCoordinates.map(c => c.virtualCoordinates ?? 0);

      const currentCoordinateControls = CoordinateControls || [];

      let jointupdates: { servoId: number; value: number }[] = [];
      let hand_joint_rad = 0.0;
      let ikResults: number[] = [];
      let changepose = false;
      // ------------------------
      // joint control
      // ------------------------
      jointupdates = currentJoints
        .map((joint) => {
          const currentDegrees = joint.virtualDegrees || 0;
          const baseKey = currentControlMap[joint.servoId!]?.[0];

          let direction = 0;

          if (currentPressedKeys.has(`${baseKey}-`)) {
            direction = -1; 
          } else if (currentPressedKeys.has(`${baseKey}+`)) {
            direction = 1; 
          } else if (currentPressedKeys.has(`${baseKey}`)) {
            direction = isReverse ? -1 : 1; 
          }

          if (direction !== 0) {
            let newValue = currentDegrees + direction * KEY_UPDATE_STEP_DEGREES;

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

      //coordinate control
      // ------------------------
      currentCoordinateControls.forEach((cm) => {
        if (!cm || !cm.name) return;

        const key = cm.keys[0];
        if (!key) return;

        const keyPressed = Array.from(currentPressedKeys).some(k => k.startsWith(key));
        if (!keyPressed) return;
        let direction = 0;

        if (currentPressedKeys.has(`${key}+`)) {
          direction = 1;
        } else if (currentPressedKeys.has(`${key}-`)) {
          direction = -1;
        } else {
          direction = isReverse ? -1 : 1;
        }

        const position_delta = 0.2 * direction;
        const orientation_delta = 0.001 * direction;

        const controlName = key.replace(/[+-]$/, ""); 

        switch (controlName) {
          case "x":
            currentpose[0] += position_delta;
            changepose = true;
            break;
          case "y":
            currentpose[1] += position_delta;
            changepose = true;
            break;
          case "z":
            currentpose[2] += position_delta;
            changepose = true;
            break;
          case "r":
            currentpose[3] += orientation_delta;
            changepose = true;
            break;
          case "p":
            currentpose[4] += orientation_delta;
            changepose = true;
            break;
          default:
            break;
        }

        // ------------------------
        // use ikresult to control joints
        // ------------------------
        if (changepose) {
          if (robotName === "roarm_m2") {
            ikResults = roarm_m2.computeJointRadbyPos(
              currentpose[0],
              currentpose[1],
              currentpose[2],
              hand_joint_rad
            );
          } else if (robotName === "roarm_m3") {
            ikResults = roarm_m3.computeJointRadbyPos(
              currentpose[0],
              currentpose[1],
              currentpose[2],
              currentpose[3],
              currentpose[4],
              hand_joint_rad
            );
          }
          changepose = false;
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
    if (activePressedKeys.size > 0) {
      intervalId = setInterval(updateJointsBasedOnKeys, KEY_UPDATE_INTERVAL_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activePressedKeys]);

  // Mouse handlers update the `pressedKeys` state, which triggers the interval effect
  const handleKeyPress = (key: string | undefined, isDown: boolean) => {
    if (!key) return;
    setPressedKeysKeyboard(prevKeys => {
      const newKeys = new Set(prevKeys);
      if (isDown) newKeys.add(key);
      else newKeys.delete(key);
      setActiveInputDevice("keyboard");
      return newKeys;
    });
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
            const increaseKey = keyboardControlMap[detail.servoId!]; // e.g. "1"

            const isDecreaseActive =
              activePressedKeys.has(`${increaseKey}-`) ||
              (!activePressedKeys.has(`${increaseKey}+`) && activePressedKeys.has(increaseKey) && isReverse);

            const isIncreaseActive =
              activePressedKeys.has(`${increaseKey}+`) ||
              (!activePressedKeys.has(`${increaseKey}-`) && activePressedKeys.has(increaseKey) && !isReverse);

            return (
              <tr key={detail.servoId}>
                <td className="">
                  {/* <span className="text-gray-600">{detail.servoId}</span>{" "} */}
                  {detail.name}
                </td>

                <td className="pr-2 text-center w-16">
                  {formatValue(detail.virtualDegrees, "°", false, true)}
                </td>
                <td className="pl-2 text-center w-16">
                  {formatValue(detail.realDegrees, "°", false, false)}
                </td>
                <td className="py-1 px-4 flex items-center">
                  <button
                    onMouseDown={() => handleKeyPress(`${increaseKey}-`, true)}
                    onMouseUp={() => handleKeyPress(`${increaseKey}-`, false)}
                    onMouseLeave={() => handleKeyPress(`${increaseKey}-`, false)} // Optional: stop if mouse leaves button while pressed
                    onTouchStart={() => handleKeyPress(increaseKey, true)} // Optional: basic touch support
                    onTouchEnd={() => handleKeyPress(increaseKey, false)} // Optional: basic touch support
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
                    onMouseDown={() => handleKeyPress(`${increaseKey}+`, true)}
                    onMouseUp={() => handleKeyPress(`${increaseKey}+`, false)}
                    onMouseLeave={() => handleKeyPress(`${increaseKey}+`, false)} // Optional
                    onTouchStart={() => handleKeyPress(increaseKey, true)} // Optional
                    onTouchEnd={() => handleKeyPress(increaseKey, false)} // Optional
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
                const coord = coordinates.find(c => c.name === cm.name);
 
                const increaseKey = cm.keys; // e.g. "1"

                const isDecreaseActive =
                  (activePressedKeys.has(`${increaseKey}-`)) ||
                  (!activePressedKeys.has(`${increaseKey}+`) && activePressedKeys.has(increaseKey) && isReverse);

                const isIncreaseActive =
                  (activePressedKeys.has(`${increaseKey}+`)) ||
                  (!activePressedKeys.has(`${increaseKey}-`) && activePressedKeys.has(increaseKey) && !isReverse);

                return (
                  <tr key={idx}>
                    <td  className="">{cm.name}</td>
                    <td className="pr-2 text-center w-16">
                    {idx <= 2
                      ? formatValue(coord?.virtualCoordinates, "mm", false, true) 
                      : formatValue(coord?.virtualCoordinates, "°", true, false)} 
                    </td>
                    <td className="pl-2 text-center w-16">
                    {idx <= 2
                      ? formatValue(coord?.realCoordinates, "mm", false, true) 
                      : formatValue(coord?.realCoordinates, "°", true, false)} 
                    </td>                    
                    <td className="py-1 px-2 text-center">
                      <div className="flex justify-center space-x-1">
                        {/* Decrease key */}
                        <button
                          onMouseDown={() => handleKeyPress(`${increaseKey}-`, true)}
                          onMouseUp={() => handleKeyPress(`${increaseKey}-`, false)}
                          onMouseLeave={() => handleKeyPress(`${increaseKey}-`, false)} // Optional
                          onTouchStart={() => handleKeyPress(increaseKey, true)} // Optional
                          onTouchEnd={() => handleKeyPress(increaseKey, false)} // Optional
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
                          onMouseDown={() => handleKeyPress(`${increaseKey}+`, true)}
                          onMouseUp={() => handleKeyPress(`${increaseKey}+`, false)}
                          onMouseLeave={() => handleKeyPress(`${increaseKey}+`, false)} // Optional
                          onTouchStart={() => handleKeyPress(increaseKey, true)} // Optional
                          onTouchEnd={() => handleKeyPress(increaseKey, false)} // Optional
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
                      </div>
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
