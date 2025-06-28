import { useCallback, useRef, useState } from "react";

enum JsonCmd {
  JOINTS_ANGLE_GET = 105,
  TORQUE_SET = 210,
  JOINT_ANGLE_CTRL = 121,
  JOINTS_ANGLE_CTRL = 122,
}

type ConnectionStatus = "unconnected" | "connecting" | "connected" | "closed";

export type WebSocketClient = {
  status: ConnectionStatus;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  joints_angle_get: () => Promise<number[]>;
  torque_set: (data: number) => void;
  joint_angle_ctrl: (data: number[]) => void;
  joints_angle_ctrl: (data: number[]) => void;
};

export function useWebSocketClient(): WebSocketClient {
  const ws = useRef<WebSocket | null>(null);
  const wsUrl = useRef<string>("ws://localhost:9090"); 
  const feedbackResolveRef = useRef<((angles: number[]) => void) | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("unconnected");

  const connect = useCallback((url: string) => {
    return new Promise<void>((resolve, reject) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.warn("WebSocket already connected");
        setStatus("connected");
        resolve();
        return;
      }

      setStatus("connecting");
      wsUrl.current = url;

      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        setStatus("connected");
        resolve();
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setStatus("unconnected");
        reject(err);
      };

      socket.onclose = () => {
        console.log("WebSocket closed");
        setStatus("closed");
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "feedback" && msg.data) {
            const anglesObj = msg.data;
            const angles = Object.keys(anglesObj)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => anglesObj[key]);

            if (feedbackResolveRef.current) {
              feedbackResolveRef.current(angles);
              feedbackResolveRef.current = null;
            }
          }
        } catch (err) {
          console.warn("Failed to decode message:", err);
        }
      };
    });
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      setStatus("closed");
    }
  }, []);

  const sendCommand = (cmd: JsonCmd, data: number[] = []) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify([cmd, ...data]);
      ws.current.send(message);
    } else {
      console.warn("WebSocket not connected, send failed");
    }
  };

  const joints_angle_get = (): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        feedbackResolveRef.current = resolve;
        ws.current.send(JSON.stringify([JsonCmd.JOINTS_ANGLE_GET]));
      } else {
        reject("WebSocket not connected");
      }
    });
  };

  const torque_set = (data: number) => {
    sendCommand(JsonCmd.TORQUE_SET, [data]);
  };

  return {
    status,
    connect,
    disconnect,
    joints_angle_get,
    torque_set,
    joint_angle_ctrl: (data) => sendCommand(JsonCmd.JOINT_ANGLE_CTRL, data),
    joints_angle_ctrl: (data) => sendCommand(JsonCmd.JOINTS_ANGLE_CTRL, data),
  };
}
