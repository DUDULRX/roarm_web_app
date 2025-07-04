# roarm_web_app

For the front-end code part, refer to the open source project: [bambot](https://github.com/timqian/bambot)

<a href="https://roarm-web-app.vercel.app">
  <img width="1130" alt="Screenshot of roarm_web_app" src="https://github.com/user-attachments/assets/ad73188b-c176-4210-900a-27f8aed5836a" />
</a>

## Demo

Try the live demo here: [roarm_web_app](https://roarm-web-app.vercel.app)

---

## Features
- **Multi-Robot Support**: Control different robot types through one app.

    ### Supported Robots

    Each robot has its own control mappings and coordinate controls.

    - **roarm_m2**  
      ![Image](https://github.com/user-attachments/assets/7a876457-2464-4941-9106-1e891d28d76e)

    - **roarm_m3**  
      ![Image](https://github.com/user-attachments/assets/52a3225d-24e4-41dc-90ac-a5f49c12945b)

- **Keyboard Control**: Intuitive web interface for keyboard operation.
- **Gamepad Control**: Intuitive web interface for gamepad operation.
- **Keyboard Controls Panel**: Dedicated web panel for keyboard control.
- **Record Dataset Panel**: Web panel for recording and replaying datasets.
- **Real-Robot Communication**: Supports Serial and WebSocket connections.
- **Control via Leader Robot**: Enables controlling follower robots through a leader robot.

---

## Deployment

You can deploy to platforms like Vercel, or locally.

### Deploy on Vercel

- Push your repository to GitHub.
- Go to [https://vercel.com](https://vercel.com) and import the repo.
- Follow Vercel’s instructions to deploy automatically.

### Deploy Locally

#### Prerequisites

- Node.js (>=14.x)
- npm (comes with Node.js)
- ros2 (optional)

#### Clone the repository:

```bash
git clone https://github.com/waveshareteam/roarm_web_app.git
```

#### Install dependencies:

   ```bash
   cd roarm_web_app/website && npm install
   ```

#### Run the development server:

   ```bash
   cd roarm_web_app/website && npm run dev
   ```

#### Open your browser and navigate to `http://localhost:3000` if running locally.

   If you're accessing the web app from another device in the same network, replace `localhost` with your computer's IP address, like:

   ```
   http://<your-ip-address>:3000
   ```

   Example: `http://192.168.9.185:3000`

---

## Usage

### Keyboard Control

Example for `roarm_m3`:

```ts
keyboardControlMap: {
  1:  "1",
  2:  "2",
  3:  "3",
  4:  "4",
  5:  "5",
  6:  "g",
},
CoordinateControls: [
  { name: "X", keys: "x" },
  { name: "Y", keys: "y" },
  { name: "Z", keys: "z" },
  { name: "Roll", keys: "r" },
  { name: "Pitch", keys: "p" },
],
```

- Control summary:
  - `s`: Switch direction between forward and reverse.
  - `1`–`5`: Move individual joints.
  - `x`, `y`, `z`: Move the end-effector in space.
  - `r`, `p`: Adjust gripper roll/pitch (for `roarm_m3`).
  - `g`: Operate the gripper.

---

### Gamepad Control

#### Enum Reference

```ts
export enum Axis {
  LEFT_STICK_X = 0,
  LEFT_STICK_Y = 1,
  RIGHT_STICK_X = 2,
  RIGHT_STICK_Y = 3,
}
export enum Button {
  RIGHT_BUMPER_1 = 5,
  RIGHT_BUMPER_2 = 7,
  LEFT_STICK_CLICK = 10,
  D_PAD_X_L = 14,
  D_PAD_X_R = 15,
}
```

#### Example Mapping for `roarm_m3`

```ts
gamepadControlMap: {
  swith_control: {
    axis: {},
    button: {
      [Button.RIGHT_BUMPER_1]: "r1",
    },
    reversedKeys: [],
  },
  joints: {
    axis: {
      [Axis.LEFT_STICK_X]: "1",
      [Axis.LEFT_STICK_Y]: "2",
      [Axis.RIGHT_STICK_X]: "5",
      [Axis.RIGHT_STICK_Y]: "4",
    },
    button: {
      [Button.LEFT_STICK_CLICK]: "3",
      [Button.D_PAD_X_L]: "g-",
      [Button.D_PAD_X_R]: "g+",
    },
    reversedKeys: ["5"],
  },
  coordinates: {
    axis: {
      [Axis.LEFT_STICK_X]: "y",
      [Axis.LEFT_STICK_Y]: "x",
      [Axis.RIGHT_STICK_X]: "r",
      [Axis.RIGHT_STICK_Y]: "p",
    },
    button: {
      [Button.LEFT_STICK_CLICK]: "z",
      [Button.D_PAD_X_L]: "g-",
      [Button.D_PAD_X_R]: "g+",
    },
    reversedKeys: ["r"],
  },
}
```

#### Gamepad Usage Instructions

- By default, the robot is in **joint control mode**.
- Press and hold `RIGHT_BUMPER_1` to switch to **coordinate control mode**.

##### Joint Control Mode

| Control                              | Action               |
| ------------------------------------ | -------------------- |
| Left Stick X                         | Joint `1`            |
| Left Stick Y                         | Joint `2`            |
| Right Stick X                        | Joint `5`            |
| Right Stick Y                        | Joint `4`            |
| Left Stick Click                     | Joint `3+`           |
| `RIGHT_BUMPER_2` + Right Stick Click | Joint `3−`           |
| D-Pad Left                           | Gripper open (`g-`)  |
| D-Pad Right                          | Gripper close (`g+`) |

##### Coordinate Control Mode (hold `RIGHT_BUMPER_1`)

| Control                              | Action               |
| ------------------------------------ | -------------------- |
| Left Stick X                         | Move along Y axis    |
| Left Stick Y                         | Move along X axis    |
| Right Stick X                        | Rotate Roll (`r`)    |
| Right Stick Y                        | Rotate Pitch (`p`)   |
| Left Stick Click                     | Move Z+              |
| `RIGHT_BUMPER_2` + Right Stick Click | Move Z−              |
| D-Pad Left                           | Gripper open (`g-`)  |
| D-Pad Right                          | Gripper close (`g+`) |

##### Notes

- **Mode Switch**: Hold `RIGHT_BUMPER_1` to toggle between modes.
- **Direction Reversal**: Some controls like Joint 5 and Roll are reversed by default.
- **Gripper Control**: Use D-Pad for open/close.
- **Robot Compatibility**: These mappings are for `roarm_m3`. `roarm_m2` model uses a simplified version.

---

### Keyboard Controls Panel

![Image](https://github.com/user-attachments/assets/d8d46fc8-5615-44a9-8514-5c69e62c0365)

- Use the "Keyboard Controls" panels to control robot joints and coordinates.
- Control behavior depends on the robot model but typically includes:
  - Press button `s` to toggle direction forward/reverse.
  - Buttons `1`, `2`, `3` (and `4`, `5` for `roarm_m3`) to move joints.
  - Buttons `X`, `Y`, and `Z` to move end-effector in 3D space.
  - For `roarm_m3`, additional buttons `R` and `P` control roll and pitch.
  - Button `G` to control the gripper.
- If the robot arm is connected, these buttons appear:
  - Button `Update Real Angles`  — updates real joint angles.
  - Button `Start Update Virtual Angles By eal Angles` — continuously updates virtual angles from real ones (robot torque disabled first).

    ![Image](https://github.com/user-attachments/assets/7f85fdd2-e21d-474c-8f89-29b45fb0ddcc)

    - Clicking it toggles to button `Stop Update Virtual Angles By Real Angles` (stop continuous update and re-enable torque).
---

### Record Dataset Panel

![Image](https://github.com/user-attachments/assets/c7a0b4a4-a3b7-4fcb-86ce-e5b39f1d3bd3)

- Use the "Record Dataset” panels to record and replay the virtual angles.

  - Button `News` — create new dataset.
  - Button `Pause` — pause recording.
  - Button `stop` — stop and save dataset.
  - Button `Replay` — replay dataset to update virtual angles (can control real robot if connected).
    - Button toggles to `Stop Replay` to stop playback.
    - Safety note: When stop replaying connected real robot arms, robotic arm may suddenly jump to recorded initial position.
  ![Image](https://github.com/user-attachments/assets/7ceecfa6-da58-4934-a202-d82d1a80aa24)

---

### Connecting to the Robot

1. **Open the web app**
   Navigate to the deployed URL (demo):
   👉 [https://roarm-web-app.vercel.app](https://roarm-web-app.vercel.app)

2. **Connect to the robot**
   Choose one method:

#### 2.1 Serial Connection (needs remote deployment)

- Connect computer directly via USB cable.

#### 2.2 WebSocket Connection (needs local deployment)

Connect remotely through WebSocket server by entering server URL.

In "Keyboard Controls" panel:

![Image](https://github.com/user-attachments/assets/1b06793f-9bc8-4031-af75-677da8dde2b9)

In "Control via Leader Robot" panel:

![Image](https://github.com/user-attachments/assets/eed90f83-2cc6-47a9-bcc2-dbc8c8a84d36)

##### Option A: `ws-server` (basic WebSocket, no ROS)

Handles direct WebSocket communication and ROS control.

Install dependencies:

```bash
cd roarm_web_app/ws-server && npm install
```

Run the WebSocket server:

```bash
cd roarm_web_app/ws-server && node websocket-server.js
```

Launch the robot driver:

```bash
cd roarm_web_app/ws-server && python3 roarm_driver.py
```

##### Option B: `ws-server-leader` (basic WebSocket, no ROS)

Run the WebSocket leader server:

```bash
cd roarm_web_app/ws-server && node websocket-server-leader.js
```

Launch the robot driver:

```bash
cd roarm_web_app/ws-server && python3 roarm_driver_leader.py
```

##### Option C: `ros-ws-server` (requires ROS 2)

Install dependencies:

```bash
cd roarm_web_app/ros-ws-server && npm install
```

Run the WebSocket server:

```bash
cd roarm_web_app/ros-ws-server && node ros-websocket-server.js
```

Launch the robot driver(requires ROS 2):

```bash
cd roarm_web_app/ros-ws-server && python3 roarm_driver.py
```

##### Option D: `ros-ws-server-leader` (requires ROS 2)

Run the WebSocket server:

```bash
cd roarm_web_app/ros-ws-server && node ros-websocket-server-leader.js
```

Launch the robot driver(requires ROS 2):

```bash
cd roarm_web_app/ros-ws-server && python3 roarm_driver_leader.py
```

#### 2.3 Enter WebSocket Server URL in Web UI

Enter server URL, e.g.:

```bash
ws://<your-ip-address>:9090
```

Example:

```bash
ws://192.168.9.185:9090
```

---

### Control via Leader Robot Panel

![Image](https://github.com/user-attachments/assets/5fdc4cf4-97f2-462b-abc7-93df1054e5ea)

- Use the "Control via Leader Robot” panels to update the virtual angles from the leader robot..

---

## Acknowledgements

- Inspired by [bambot](https://github.com/timqian/bambot)

---

**Enjoy controlling your robot! 🤖🚀**