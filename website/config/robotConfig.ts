// Define camera settings type
type CameraSettings = {
  position: [number, number, number];
  fov: number;
};

// Define a type for coordinate movements
type CoordinateControls = {
  name: string;
  keys: string; // keys that trigger this movement
};

// Define combined robot configuration type
export type RobotConfig = {
  urdfUrl: string;
  camera: CameraSettings;
  orbitTarget: [number, number, number];
  keyboardControlMap?: {
    [key: string]: string;
  };
  jointNameIdMap?: {
    [key: string]: number;
  };
  CoordinateControls?: CoordinateControls[];
  controlPrompt?: string;
  systemPrompt?: string; // <-- Add this line
};

// Define configuration map per slug
export const robotConfigMap: { [key: string]: RobotConfig } = {
  "roarm_m2": {
    urdfUrl: "/URDF/roarm_m2.urdf",  
    camera: { position: [20, 20, 50], fov: 20 },
    orbitTarget: [0, 1, 0],
    keyboardControlMap: {
      1:  "1",
      2:  "2",
      3:  "3",
      4:  "g",
    },
    jointNameIdMap: {
      base_link_to_link1: 1,
      link1_to_link2: 2,
      link2_to_link3: 3,
      link3_to_gripper_link: 4,
    },
    CoordinateControls: [
      {
        name: "X",
        keys: "x",
      },
      {
        name: "Y",
        keys: "y",
      },
      {
        name: "Z",
        keys:  "z",
      },             
    ],
    systemPrompt: `You can help control the roarm_m3 robot by pressing keyboard keys. Use the keyPress tool to simulate key presses. Each key will be held down for 1 second by default. If the user describes roughly wanting to make it longer or shorter, adjust the duration accordingly.
    The robot can be controlled with the following keys:
    - "1" to "3" for moving the robot's joints.
    - "g" for moving the gripper.
    - "x" for moving the gripper backward and forward.
    - "y" for moving the gripper left and right.
    - "z" for moving the gripper up and down.
    - "s" to switch the movement direction, default is forward.
    `,
  },   
  "roarm_m3": {
    urdfUrl: "/URDF/roarm_m3.urdf",  
    camera: { position: [20, 20, 50], fov: 20 },
    orbitTarget: [0, 1, 0],
    keyboardControlMap: {
      1:  "1",
      2:  "2",
      3:  "3",
      4:  "4",
      5:  "5",
      6:  "g",
    },
    jointNameIdMap: {
      base_link_to_link1: 1,
      link1_to_link2: 2,
      link2_to_link3: 3,
      link3_to_link4: 4,
      link4_to_link5: 5,
      link5_to_gripper_link: 6,
    },
    CoordinateControls: [
      {
        name: "X",
        keys: "x",
      },
      {
        name: "Y",
        keys: "y",
      },
      {
        name: "Z",
        keys:  "z",
      },  
      {
        name: "Roll",
        keys: "r",
      },
      {
        name: "Pitch",
        keys: "p",
      },                
    ],
    systemPrompt: `You can help control the roarm_m3 robot by pressing keyboard keys. Use the keyPress tool to simulate key presses. Each key will be held down for 1 second by default. If the user describes roughly wanting to make it longer or shorter, adjust the duration accordingly.
    The robot can be controlled with the following keys:
    - "1" to "5" for moving the robot's joints.
    - "g" for moving the gripper.
    - "x" for moving the gripper backward and forward.
    - "y" for moving the gripper left and right.
    - "z" for moving the gripper up and down.
    - "r" for rolling the gripper.
    - "p" for pitching the gripper.
    - "s" to switch the movement direction, default is forward.
    `,
  },  
};
