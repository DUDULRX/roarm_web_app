import asyncio
import websockets
import json
import os
from roarm_sdk.roarm import roarm
from serial import SerialException

ROARM_TYPE = os.environ.get('ROARM_MODEL', 'roarm_m3')
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
WS_SERVER = 'ws://localhost:9090'  # WebSocket 服务器地址

# 初始化 roarm 实例
roarm_device = roarm(roarm_type=ROARM_TYPE, port=SERIAL_PORT, baudrate=BAUD_RATE)

async def handle_ws():
    async with websockets.connect(WS_SERVER) as websocket:

        while True:
            try:
                message = await websocket.recv()

                data = json.loads(message)
                if not isinstance(data, list):
                    continue

                cmd = int(data[0])
                args = data[1:]

                if cmd == 105:
                    angles = roarm_device.joints_angle_get()
                    # 回复前端
                    feedback = json.dumps({
                        "type": "feedback",
                        "data": angles
                    })
                    await websocket.send(feedback)

                elif cmd == 210:
                    roarm_device.torque_set(int(args[0]))
                    roarm_device.feedback_get()

                elif cmd == 121:
                    roarm_device.joint_angle_ctrl(args[0], args[1])
                    roarm_device.feedback_get()

                elif cmd == 122:
                    roarm_device.joints_angle_ctrl(angles=args, speed=1000, acc=50)
                    roarm_device.feedback_get()

                else:
                    print(f"❓ 未知命令: {cmd}")

            except json.JSONDecodeError:
                print("❌ JSON 解析失败")
            except SerialException as e:
                print(f"❌ 串口错误: {e}")
            except Exception as e:
                print(f"❌ 执行错误: {e}")

if __name__ == "__main__":
    asyncio.run(handle_ws())
