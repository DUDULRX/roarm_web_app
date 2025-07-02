import React, { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import useMeasure from "react-use-measure";
import { panelStyle } from "@/components/playground/panelStyle";
import { SettingsWebSocketModal } from "../controlButtons/SettingsWebSocketModal";
import ConnectionControlSection from "../controlButtons/ConnectionSectionButton";
import { Roarm } from "roarm-sdk";

const SYNC_INTERVAL = 10; // ms

type JointDetails = {
  name: string;
  servoId: number;
  jointType: "revolute" | "continuous";
  limit?: {
    lower?: number;
    upper?: number;
  };
};

type AngleState = {
  servoId: number;
  angle: number;
};

type LeaderControlProps = {
  show?: boolean;
  onHide?: () => void;
  jointDetails: JointDetails[];
  robotName: string;
  leaderControl: {
    isSerialConnected: boolean;
    isWebSocketConnected: boolean;
    connectRobot: (args: { roarm?: Roarm; url?: string }) => Promise<void>;
    disconnectRobot: () => Promise<void>;
    getAngles: () => Promise<number[]>;
  };
  onSync: (angles: AngleState[]) => void;
};

const formatRealDegrees = (degrees?: number | "N/A" | "error") => {
  if (degrees === "error") {
    return <span className="text-red-500">Error</span>;
  }
  return degrees === "N/A" ? "/" : `${degrees?.toFixed(1)}°`;
};

export function LeaderControl({
  show = true,
  onHide,
  jointDetails,
  robotName,
  leaderControl,
  onSync,
}: LeaderControlProps) {
  const revoluteJoints = jointDetails.filter((j) => j.jointType === "revolute");
  const { isSerialConnected, isWebSocketConnected, connectRobot, disconnectRobot, getAngles } =
    leaderControl;

  const [angles, setAngles] = useState<AngleState[]>(
    revoluteJoints.map((j) => ({
      servoId: j.servoId,
      angle: 0,
    }))
  );

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
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Sync angles periodically
  useEffect(() => {
    if (!isSerialConnected && !isWebSocketConnected) return;
    const timer = setInterval(async () => {
      try {
        const angleValues = await getAngles();
        if (!Array.isArray(angleValues) || angleValues.length === 0) return;

        const leaderAngles: AngleState[] = revoluteJoints.map((j, idx) => ({
          servoId: j.servoId,
          angle: angleValues[idx] ?? 0,
        }));

        setAngles(leaderAngles);
        onSync(leaderAngles);
      } catch (err) {
        console.error("Failed to get angles:", err);
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(timer);
  }, [isSerialConnected, isWebSocketConnected, revoluteJoints, getAngles, onSync]);

  // Initial position
  useEffect(() => {
    if (bounds.height > 0) {
      setPosition({ x: 20, y: window.innerHeight - bounds.height - 20 });
    }
  }, [bounds.height]);

  const handleConfirmWsModal = async (inputUrl: string) => {
    try {
      setWebSocketConnectionStatus("connecting");
      await connectRobot({ url: inputUrl });
      localStorage.setItem("ws_server_url", inputUrl);
      setShowWsModal(false);
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      alert("Connection failed. Please check the address.");
    } finally {
      setWebSocketConnectionStatus("idle");
    }
  };

  const handleConnect = async (type: string) => {
    if (type === "Serial") {
      setSerialConnectionStatus("connecting");
      try {
        if (!roarmRef.current) {
          roarmRef.current = new Roarm({
            roarm_type: robotName,
            baudrate: "115200",
          });
        }
        await connectRobot({ roarm: roarmRef.current });
      } finally {
        setSerialConnectionStatus("idle");
      }
    } else if (type === "WebSocket") {
      setShowWsModal(true);
    }
  };

  const handleDisconnect = async (type: string) => {
    if (type === "Serial") {
      setSerialConnectionStatus("disconnecting");
      try {
        await disconnectRobot();
      } finally {
        setSerialConnectionStatus("idle");
      }
    } else if (type === "WebSocket") {
      setWebSocketConnectionStatus("disconnecting");
      try {
        await disconnectRobot();
      } finally {
        setWebSocketConnectionStatus("idle");
      }
    }
  };

  if (!show) return null;

  return (
    <Rnd
      position={position}
      onDragStop={(_, d) => setPosition({ x: d.x, y: d.y })}
      bounds="window"
      className="z-50"
      style={{ display: show ? undefined : "none" }}
    >
      <div ref={ref} className={"max-h-[90vh] overflow-y-auto text-sm " + panelStyle}>
        <h3 className="mt-0 mb-4 border-b border-white/50 pb-1 font-bold text-base flex justify-between items-center">
          <span>Control via Leader Robot</span>
          <button
            className="ml-2 text-xl hover:bg-zinc-800 px-2 rounded-full"
            title="Collapse"
            onClick={onHide}
            onTouchEnd={onHide}
          >
            ×
          </button>
        </h3>

        {revoluteJoints.length === 0 ? (
          <div className="mt-4 text-center text-gray-400">
            No joints available for leader control.
          </div>
        ) : (
          <>
            <div className="mt-4">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="border-b border-gray-600 pb-1">Joint</th>
                    <th className="border-b border-gray-600 pb-1 text-center pl-4">Angle</th>
                  </tr>
                </thead>
                <tbody>
                  {revoluteJoints.map((j) => {
                    const matched = angles.find((a) => a.servoId === j.servoId);
                    return (
                      <tr key={j.servoId}>
                        <td className="py-1">{j.name}</td>
                        <td className="py-1 text-center">
                          {formatRealDegrees(matched?.angle ?? "N/A")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isWebSocketConnected && (
          <ConnectionControlSection
            title="Serial"
            type="leader"
            isConnected={isSerialConnected}
            isSyncing={isSyncing}
            isConnecting={serialConnectionStatus === "connecting"}
            isDisconnecting={serialConnectionStatus === "disconnecting"}
            onConnect={() => handleConnect("Serial")}
            onDisconnect={() => handleDisconnect("Serial")}
            onUpdateRealAngles={() => {}}
            onToggleSync={() => setIsSyncing((prev) => !prev)}
          />
        )}

        {!isSerialConnected && (
          <ConnectionControlSection
            title="WebSocket"
            type="leader"
            isConnected={isWebSocketConnected}
            isSyncing={isSyncing}
            isConnecting={webSocketConnectionStatus === "connecting"}
            isDisconnecting={webSocketConnectionStatus === "disconnecting"}
            onConnect={() => handleConnect("WebSocket")}
            onDisconnect={() => handleDisconnect("WebSocket")}
            onUpdateRealAngles={() => {}}
            onToggleSync={() => setIsSyncing((prev) => !prev)}
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
