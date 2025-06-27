import { useEffect, useRef, useState } from "react";

enum JsonCmd {
  JOINTS_ANGLE_GET = 105,
  TORQUE_SET = 210,
  JOINT_ANGLE_CTRL = 121,
  JOINTS_ANGLE_CTRL = 122,
}

export type RosWebSocketClient = {
  status: string;
  joints_angle_get: () => Promise<number[]>;
  torque_set: (data: number) => void;
  joint_angle_ctrl: (data: number[]) => void;
  joints_angle_ctrl: (data: number[]) => void;
};

export function useRosWebSocketClient(): RosWebSocketClient {
  const ws = useRef<WebSocket | null>(null);
  const feedbackResolveRef = useRef<((angles: number[]) => void) | null>(null);
  const [status, setStatus] = useState("未连接");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9090");
    ws.current = socket;

    socket.onopen = () => {
      console.log("✅ WebSocket 连接成功");
      setStatus("已连接");
    };

    socket.onmessage = (event) => {
      console.log("📩 收到消息:", event.data);

      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "feedback" && msg.data) {
          // data 是对象，需要转换成数组
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
        console.warn("解析收到的消息失败", err);
      }
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket 已断开");
      setStatus("已断开");
    };

    socket.onerror = (err) => {
      console.error("❌ WebSocket 出错", err);
    };

    return () => {
      feedbackResolveRef.current = null;
      socket.close();
    };
  }, []);

  const sendCommand = (cmd: JsonCmd, data: number[] = []) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify([cmd, ...data]);
      ws.current.send(message);
    } else {
      console.warn("⚠️ WebSocket 未连接，发送失败");
    }
  };

  const joints_angle_get = (): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        feedbackResolveRef.current = resolve;
        ws.current.send(JSON.stringify([JsonCmd.JOINTS_ANGLE_GET]));
      } else {
        reject("⚠️ WebSocket 未连接");
      }
    });
  };

  const torque_set = (data: number) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify([JsonCmd.TORQUE_SET, data]);
      ws.current.send(message);
    } else {
      console.warn("⚠️ WebSocket 未连接，发送失败");
    }
  };

  return {
    status,
    joints_angle_get,
    torque_set,
    joint_angle_ctrl: (data) => sendCommand(JsonCmd.JOINT_ANGLE_CTRL, data),
    joints_angle_ctrl: (data) => sendCommand(JsonCmd.JOINTS_ANGLE_CTRL, data),
  };
}
