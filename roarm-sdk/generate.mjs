import * as math from 'mathjs'; // 需要安装 mathjs 或用内置 Math 替换

import { calibrationParameters } from './utils.mjs';
import { JsonCmd,DataProcessor} from './common.mjs';

export class CommandGenerator extends DataProcessor {
  constructor(roarm_type = null, debug = false) {
    super();
    this.type = roarm_type;
    this.debug = debug;
    // setupLogging(this.debug);
    this.log = console; 
    this.calibrationParameters = calibrationParameters;
  }

  echo_set(cmd) {
    this.calibrationParameters({ roarm_type: this.type, cmd });
    return this._mesg(JsonCmd.ECHO_SET, cmd);
  }

  middle_set() {
    return this._mesg(JsonCmd.MIDDLE_SET, 254);
  }

  move_init() {
    const switchDict = {
      roarm_m2: [0, 0, 1.5708, 0],
      roarm_m3: [0, 0, 1.5708, 0, 0, 0],
    };
    const radians = switchDict[this.type];
    this.joints_radian_ctrl(radians, 100, 0);
    return 1;
  }

  led_ctrl(led) {
    this.calibrationParameters({ roarm_type: this.type, led });
    return this._mesg(JsonCmd.LED_CTRL, led);
  }

  torque_set(cmd) {
    this.calibrationParameters({ roarm_type: this.type, cmd });
    return this._mesg(JsonCmd.TORQUE_SET, cmd);
  }

  dynamic_adaptation_set(mode, torques) {
    this.calibrationParameters({ roarm_type: this.type, mode, torques });
    return this._mesg(JsonCmd.DYNAMIC_ADAPTATION_SET, mode, torques);
  }

  feedback_get() {
    return this._mesg(JsonCmd.FEEDBACK_GET);
  }

  joint_radian_ctrl(joint, radian, speed, acc) {
    this.calibrationParameters({ roarm_type: this.type, joint, radian, speed, acc });
    return this._mesg(JsonCmd.JOINT_RADIAN_CTRL, joint, radian, speed, acc);
  }

  joints_radian_ctrl(radians, speed, acc) {
    this.calibrationParameters({ roarm_type: this.type, radians, speed, acc });
    return this._mesg(JsonCmd.JOINTS_RADIAN_CTRL, radians, speed, acc);
  }

  joints_radian_get() {
    const value = this.feedback_get();

    const switchDict = {
      roarm_m2: Uint8Array.prototype.slice.call(value, 3, 7),
      roarm_m3: Uint8Array.prototype.slice.call(value, 4, 10),
    };

    return switchDict[this.type];
  }


  joint_angle_ctrl(joint, angle, speed, acc) {
    this.calibrationParameters({ roarm_type: this.type, joint, angle, speed, acc });
    return this._mesg(JsonCmd.JOINT_ANGLE_CTRL, joint, angle, speed, acc);
  }

  joints_angle_ctrl(angles, speed, acc) {
    this.calibrationParameters({ roarm_type: this.type, angles, speed, acc });
    return this._mesg(JsonCmd.JOINTS_ANGLE_CTRL, angles, speed, acc);
  }

  joints_angle_get() {
    const value = this.feedback_get();
    console.log('value', value);

    if (!(value instanceof Uint8Array)) {
      throw new Error('feedback_get() did not return a Uint8Array or Buffer');
    }

    const switchDict = {
      roarm_m2: Uint8Array.prototype.slice.call(value, 3, 7),
      roarm_m3: Uint8Array.prototype.slice.call(value, 4, 10),
    };

    const radians = switchDict[this.type];

    if (!radians) {
      throw new Error(`Unsupported roarm_type: ${this.type}`);
    }

    return radians.map(radian => (radian * 180) / Math.PI);
  }

  gripper_mode_set(mode) {
    this.calibrationParameters({ roarm_type: this.type, mode });
    return this._mesg(JsonCmd.GRIPPER_MODE_SET, mode);
  }

  gripper_radian_ctrl(radian, speed, acc) {
    const switchDict = {
      roarm_m2: 4,
      roarm_m3: 6,
    };
    const gripper = switchDict[this.type];
    this.joint_radian_ctrl(gripper, radian, speed, acc);
    return 1;
  }

  gripper_angle_ctrl(angle, speed, acc) {
    const switchDict = {
      roarm_m2: 4,
      roarm_m3: 6,
    };
    const gripper = switchDict[this.type];
    this.joint_angle_ctrl(gripper, angle, speed, acc);
    return 1;
  }

  gripper_radian_get() {
    const switchDict = {
      roarm_m2: 6,
      roarm_m3: 9,
    };
    const gripper = switchDict[this.type];
    const value = this.feedback_get();
    return value[gripper];
  }

  gripper_angle_get() {
    const switchDict = {
      roarm_m2: 6,
      roarm_m3: 9,
    };
    const gripper = switchDict[this.type];
    const value = this.feedback_get();
    return (value[gripper] * 180) / Math.PI;
  }

  pose_ctrl(pose) {
    this.calibrationParameters({ roarm_type: this.type, pose });
    return this._mesg(JsonCmd.POSE_CTRL, pose);
  }

  pose_get() {
    const value = this.feedback_get();

    if (!(value instanceof Uint8Array)) {
      throw new Error('feedback_get() did not return a Uint8Array');
    }

    const padded = new Uint8Array(20);
    padded.set(value.slice(0, Math.min(value.length, 20)));

    const switchDict = {
      roarm_m2: [
        ...Uint8Array.prototype.slice.call(padded, 0, 3),
        padded[6]
      ],
      roarm_m3: [
        ...Uint8Array.prototype.slice.call(padded, 0, 4),
        padded[8],
        padded[9]
      ],
    };

    const poses = switchDict[this.type];
    if (!poses) {
      throw new Error(`Unsupported robot type: ${this.type}`);
    }

    for (let i = 3; i < poses.length; i++) {
      poses[i] = (poses[i] * 180) / Math.PI;
    }

    return poses;
  }


  wifi_on_boot(wifi_cmd) {
    this.calibrationParameters({ roarm_type: this.type, wifi_cmd });
    return this._mesg(JsonCmd.WIFI_ON_BOOT, wifi_cmd);
  }

  ap_set(ssid, password) {
    this.calibrationParameters({ roarm_type: this.type, ssid, password });
    return this._mesg(JsonCmd.AP_SET, ssid, password);
  }

  sta_set(ssid, password) {
    this.calibrationParameters({ roarm_type: this.type, ssid, password });
    return this._mesg(JsonCmd.STA_SET, ssid, password);
  }

  apsta_set(ap_ssid, ap_password, sta_ssid, sta_password) {
    this.calibrationParameters({ roarm_type: this.type, ssid: ap_ssid, password: ap_password });
    this.calibrationParameters({ roarm_type: this.type, ssid: sta_ssid, password: sta_password });
    return this._mesg(JsonCmd.APSTA_SET, ap_ssid, ap_password, sta_ssid, sta_password);
  }

  wifi_config_creat_by_status() {
    return this._mesg(JsonCmd.WIFI_CONFIG_CREATE_BY_STATUS);
  }

  wifi_config_creat_by_input(ap_ssid, ap_password, sta_ssid, sta_password) {
    this.calibrationParameters({ roarm_type: this.type, ssid: ap_ssid, password: ap_password });
    this.calibrationParameters({ roarm_type: this.type, ssid: sta_ssid, password: sta_password });
    return this._mesg(JsonCmd.WIFI_CONFIG_CREATE_BY_INPUT, ap_ssid, ap_password, sta_ssid, sta_password);
  }

  wifi_stop() {
    return this._mesg(JsonCmd.WIFI_STOP);
  }
}
