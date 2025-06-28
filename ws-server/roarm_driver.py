import asyncio
import websockets
import json
import os
from roarm_sdk.roarm import roarm
from serial import SerialException

ROARM_TYPE = os.environ.get('ROARM_MODEL', 'roarm_m3')
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
WS_SERVER = 'ws://localhost:9090'

roarm = roarm(roarm_type=ROARM_TYPE, port=SERIAL_PORT, baudrate=BAUD_RATE)

latest_commands = {}
command_event = asyncio.Event()
command_lock = asyncio.Lock()

async def handle_get_angles(args, websocket):
    angles = roarm.joints_angle_get()
    await websocket.send(json.dumps({"type": "feedback", "data": angles}))

async def handle_torque_set(args, websocket):
    roarm.torque_set(int(args[0]))
    angles = roarm.joints_angle_get()
    await websocket.send(json.dumps({"type": "feedback", "data": angles}))

async def handle_joint_angle_ctrl(args, websocket):
    roarm.joint_angle_ctrl(int(args[0]), args[1], speed=1000, acc=50)
    angles = roarm.joints_angle_get()
    await websocket.send(json.dumps({"type": "feedback", "data": angles}))

async def handle_joints_angle_ctrl(args, websocket):
    roarm.joints_angle_ctrl(angles=args, speed=1000, acc=50)
    angles = roarm.joints_angle_get()
    await websocket.send(json.dumps({"type": "feedback", "data": angles}))

COMMAND_HANDLERS = {
    105: handle_get_angles,
    210: handle_torque_set,
    121: handle_joint_angle_ctrl,
    122: handle_joints_angle_ctrl,
}

async def websocket_listener():
    async with websockets.connect(WS_SERVER) as websocket:
        async for message in websocket:
            try:
                data = json.loads(message)
                if isinstance(data, list):
                    cmd = int(data[0])
                    async with command_lock:
                        latest_commands[cmd] = (data[1:], websocket)
                        command_event.set()
            except json.JSONDecodeError:
                print("JSON decode error")
            except Exception as e:
                print(f"Listener error: {e}")

async def command_executor():
    while True:
        await command_event.wait()
        command_event.clear()

        async with command_lock:
            commands_to_run = latest_commands.copy()
            latest_commands.clear()

        for cmd, (args, websocket) in commands_to_run.items():
            handler = COMMAND_HANDLERS.get(cmd)
            if handler:
                try:
                    await handler(args, websocket)
                except Exception as e:
                    print(f"Error handling cmd {cmd}: {e}")
            else:
                print(f"Unknown command: {cmd}")

async def main():
    await asyncio.gather(
        websocket_listener(),
        command_executor()
    )

if __name__ == "__main__":
    asyncio.run(main())
