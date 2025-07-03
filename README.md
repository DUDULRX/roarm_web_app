
<a href="https://roarm-web-app.vercel.app">
  <img width="1130" alt="Screenshot of roarm_web_app" src="https://github.com/user-attachments/assets/ad73188b-c176-4210-900a-27f8aed5836a" />
</a>

<br/><br/><br/>

# roarm_web_app

Play with open-source, low-cost robots 🤖

For the front-end code part, refer to the open source project: [bambot GitHub Repository](https://github.com/timqian/bambot)

---

## Features

- **Open Source**: Fully open for contributions and customization.
- **Low Cost**: Build and control robots affordably.
- **Interactive UI**: Web interface to control robots intuitively.
- **Cross-Platform**: Compatible with modern browsers and mobile devices.
- **Real-Time Communication**: Supports Serial and WebSocket connections.
- **Multi-Robot Support**: Control different robot types through one app.

---

## Demo

Try the live demo here: [roarm_web_app](https://roarm-web-app.vercel.app)

---

## Getting Started

### Prerequisites

- Node.js (>=14.x)
- npm (comes with Node.js)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/waveshareteam/roarm_web_app.git
   cd roarm_web_app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` if running locally.

   If you're accessing the web app from another device in the same network, replace `localhost` with your computer's IP address, like:

   ```
   http://<your-ip-address>:3000
   ```

   Example: `http://192.168.1.123:3000`

---

## Deployment

You can deploy to platforms like Vercel, Netlify, or your own server.

### Deploy on Vercel

- Push your repository to GitHub.
- Go to [https://vercel.com](https://vercel.com) and import the repo.
- Follow Vercel’s instructions to deploy automatically.

---

## Usage

### Supported Robots

This web app currently supports two robot models:

- **roarm_m2**  
  ![Image](https://github.com/user-attachments/assets/7a876457-2464-4941-9106-1e891d28d76e)

- **roarm_m3**  
  ![Image](https://github.com/user-attachments/assets/52a3225d-24e4-41dc-90ac-a5f49c12945b)

Each robot has its own URDF model, camera settings, control mappings, and coordinate controls.

### Connecting to the Robot

1. Open the web app in your browser at the deployed URL (e.g., [https://roarm-web-app.vercel.app](https://roarm-web-app.vercel.app)).
2. Connect to the robot either via:
   - **Serial connection**: Connect your computer directly to the robot using a USB cable.
   - **WebSocket connection**: Connect remotely to the robot through a WebSocket server by entering the server URL.

---

### UI Control

- Use the UI panels to control robot joints and coordinates.
- Control behavior depends on the robot model but typically includes:
  - Press button `s` to toggle movement direction between forward and reverse.
  - Buttons `1`, `2`, `3` (and `4`, `5` for `roarm_m3`) to move individual joints.
  - Buttons `X`, `Y`, and `Z` to move the end-effector in 3D space.
  - For `roarm_m3`, additional buttons `R` and `P` control the roll and pitch.
  - Button `G` to control the gripper.

---

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
  RIGHT_STICK_CLICK = 10,
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
      [Button.RIGHT_STICK_CLICK]: "3",
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
      [Button.RIGHT_STICK_CLICK]: "z",
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

| Control                              | Action                                |
|-------------------------------------|---------------------------------------|
| Left Stick X                        | Joint `1`                             |
| Left Stick Y                        | Joint `2`                             |
| Right Stick X                       | Joint `5`                             |
| Right Stick Y                       | Joint `4`                             |
| Right Stick Click                   | Joint `3+`                            |
| `RIGHT_BUMPER_2` + Right Stick Click| Joint `3−`                            |
| D-Pad Left                          | Gripper open (`g-`)                   |
| D-Pad Right                         | Gripper close (`g+`)                  |

##### Coordinate Control Mode (hold `RIGHT_BUMPER_1`)

| Control                              | Action               |
|-------------------------------------|----------------------|
| Left Stick X                        | Move along Y axis    |
| Left Stick Y                        | Move along X axis    |
| Right Stick X                       | Rotate Roll (`r`)    |
| Right Stick Y                       | Rotate Pitch (`p`)   |
| Right Stick Click                   | Move Z+              |
| `RIGHT_BUMPER_2` + Right Stick Click| Move Z−              |
| D-Pad Left                          | Gripper open (`g-`)  |
| D-Pad Right                         | Gripper close (`g+`) |

##### Notes

- **Mode Switch**: Hold `RIGHT_BUMPER_1` to toggle between modes.
- **Direction Reversal**: Some controls like Joint 5 and Roll are reversed by default.
- **Gripper Control**: Use D-Pad for open/close.
- **Robot Compatibility**: These mappings are for `roarm_m3`. The `roarm_m2` model uses a simplified version.

---

## Configuration

The app supports flexible configuration:

- Customize keyboard and gamepad inputs using `RobotConfig`.
- Define `CoordinateControls` per robot.

---

## Acknowledgements

- Inspired by [bambot](https://github.com/timqian/bambot)
- Built with ❤️ by the community and contributors

---

**Enjoy controlling your robot! 🤖🚀**
