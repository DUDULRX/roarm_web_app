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

type ControlMap = {
  axis: Partial<Record<Axis, string>>;  
  button: Partial<Record<Button, string>>; 
  reversedKeys: string[];
};

// Define combined robot configuration type
export type RobotConfig = {
  urdfUrl: string;
  camera: CameraSettings;
  orbitTarget: [number, number, number];
  keyboardControlMap?: {
    [key: string]: string;
  };
  gamepadControlMap?:{
    [mode: string]: ControlMap
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
    gamepadControlMap: {
      swith_control: {       
        axis: {
        },
        button: {
          [Button.RIGHT_BUMPER_1]: "r1",
        },
        reversedKeys: [],
      },
      joints: {
        axis: {
          [Axis.LEFT_STICK_X]: "1",
          [Axis.LEFT_STICK_Y]: "2",
        },
        button: {
          [Button.LEFT_STICK_CLICK]: "3", //3 => 3+, [Button.RIGHT_BUMPER_2]: "r2", //r2 + 3 => 3-
          [Button.D_PAD_X_L]: "g-",   
          [Button.D_PAD_X_R]: "g+",
        },
        reversedKeys: [],
      },
      coordinates: {
        axis: {
          [Axis.LEFT_STICK_X]: "y",
          [Axis.LEFT_STICK_Y]: "x",
        },
        button: {
          [Button.LEFT_STICK_CLICK]: "z", //z => z+, [Button.RIGHT_BUMPER_2]: "r2", //r2 + z => z-
          [Button.D_PAD_X_L]: "g-",   
          [Button.D_PAD_X_R]: "g+",
        },
        reversedKeys: [],
      },
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
    gamepadControlMap: {
      swith_control: {       
        axis: {
        },
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
          [Button.LEFT_STICK_CLICK]: "3", //3 => 3+, [Button.RIGHT_BUMPER_2]: "r2", //r2 + 3 => 3-
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
          [Button.LEFT_STICK_CLICK]: "z", //z => z+, [Button.RIGHT_BUMPER_2]: "r2", //r2 + z => z-
          [Button.D_PAD_X_L]: "g-",   
          [Button.D_PAD_X_R]: "g+",
        },
        reversedKeys: ["r"],
      },
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
