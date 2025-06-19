// base-controller.mjs
const JsonCmd = {
  ECHO_SET: 605,
  MIDDLE_SET: 502,
  LED_CTRL: 114,
  TORQUE_SET: 210,
  DYNAMIC_ADAPTATION_SET: 112,
  FEEDBACK_GET: 105,
  JOINT_RADIAN_CTRL: 101,
  JOINTS_RADIAN_CTRL: 102,
  JOINT_ANGLE_CTRL: 121,
  JOINTS_ANGLE_CTRL: 122,
  GRIPPER_MODE_SET: 222,
  POSE_CTRL: 1041,
  WIFI_ON_BOOT: 401,
  AP_SET: 402,
  STA_SET: 403,
  APSTA_SET: 404,
  WIFI_CONFIG_CREATE_BY_STATUS: 406,
  WIFI_CONFIG_CREATE_BY_INPUT: 407,
  WIFI_STOP: 408,
};

class ReadLine {
  constructor(portHandler, timeout = 2000) {
    this.portHandler = portHandler;         // PortHandler 实例
    this.buf = "";                           // 字符串缓冲区
    this.frameStart = "{";
    this.frameEnd = "}\r\n";
    this.maxFrameLength = 512;
    this.timeout = timeout;                  // ms
  }

  async readline() {
    const startTime = performance.now();
    const reader = this.portHandler.reader;

    if (!reader) {
      throw new Error('PortHandler reader not initialized.');
    }

    while (true) {
      try {
        const { value, done } = await reader.read();

        if (done) {
          console.warn("Serial reader closed.");
          return null;
        }

        if (value) {
          this.buf += value; 

          if (this.buf.length > this.maxFrameLength) {
            console.warn("Buffer overflow, clearing buffer.");
            this.buf = "";
            continue;
          }

          const endIdx = this.buf.indexOf(this.frameEnd);
          if (endIdx !== -1) {
            const startIdx = this.buf.lastIndexOf(this.frameStart, endIdx);
            if (startIdx !== -1 && startIdx < endIdx) {
              const frame = this.buf.slice(startIdx, endIdx + this.frameEnd.length);
              this.buf = this.buf.slice(endIdx + this.frameEnd.length); 
              console.log("frame",frame)
              return frame;
            }
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        const elapsed = performance.now() - startTime;
        console.log("ReadLine time.",elapsed);

        // if (elapsed > this.timeout) {
          // console.warn("ReadLine timeout.",elapsed);
          // return null;
        // }
      } catch (err) {
        console.error("ReadLine error:", err);
        return null;
      }
    }
  }

  clearBuffer() {
    this.buf = "";
  }
}

class BaseController {
  constructor(roarmType, serialPort) {
    this.type = roarmType;
    this.serialPort = serialPort;
    this.rl = new ReadLine(serialPort);
    this.dataBuffer = null;

    this.baseData = {
      roarm_m2: { T: 1051, x: 0, y: 0, z: 0, b: 0, s: 0, e: 0, t: 0, torB: 0, torS: 0, torE: 0, torH: 0 },
      roarm_m3: { T: 1051, x: 0, y: 0, z: 0, tit: 0, b: 0, s: 0, e: 0, t: 0, r: 0, g: 0, tB: 0, tS: 0, tE: 0, tT: 0, tR: 0, tG: 0 },
    }[roarmType];
  }

  async feedbackData() {
    try {
      const line = await this.rl.readline();
      if (!line) return null;
      console.log("line",line)
      this.dataBuffer = JSON.parse(line);
      this.baseData = this.dataBuffer;
      this.rl.clearBuffer();
      return this.baseData;
    } catch (e) {
      console.error('JSON decode or feedbackData error:', e);
      this.rl.clearBuffer();
      return null;
    }
  }
}

// Command handlers

function handleEchoOrTorqueSet(roarmType, command, commandData) {
  command.cmd = commandData[0];
  return command;
}

function handleMiddleSet(roarmType, command, commandData) {
  command.id = commandData[0];
  return command;
}

function handleLedCtrl(roarmType, command, commandData) {
  command.led = commandData[0];
  return command;
}

function handleM2DynamicAdaptation(command, commandData) {
  const [mode, b, s, e, h] = commandData;
  Object.assign(command, { mode, b, s, e, h });
  return command;
}

function handleM3DynamicAdaptation(command, commandData) {
  const [mode, b, s, e, t, r, h] = commandData;
  Object.assign(command, { mode, b, s, e, t, r, h });
  return command;
}

function handleDynamicAdaptationSet(roarmType, command, commandData) {
  const handlers = {
    roarm_m2: handleM2DynamicAdaptation,
    roarm_m3: handleM3DynamicAdaptation,
  };
  return handlers[roarmType](command, commandData);
}

function handleJointRadianCtrl(roarmType, command, commandData) {
  const gripper = { roarm_m2: 4, roarm_m3: 6 }[roarmType];
  if (commandData[0] === gripper) {
    commandData[1] = Math.PI - commandData[1];
  }
  Object.assign(command, {
    joint: commandData[0],
    rad: commandData[1],
    spd: commandData[2],
    acc: commandData[3],
  });
  return command;
}

function handleM2JointsRadian(command, commandData) {
  commandData[3] = Math.PI - commandData[3];
  Object.assign(command, {
    base: commandData[0],
    shoulder: commandData[1],
    elbow: commandData[2],
    hand: commandData[3],
    spd: commandData[4],
    acc: commandData[5],
  });
  return command;
}

function handleM3JointsRadian(command, commandData) {
  commandData[5] = Math.PI - commandData[5];
  Object.assign(command, {
    base: commandData[0],
    shoulder: commandData[1],
    elbow: commandData[2],
    wrist: commandData[3],
    roll: commandData[4],
    hand: commandData[5],
    spd: commandData[6],
    acc: commandData[7],
  });
  return command;
}

function handleJointsRadianCtrl(roarmType, command, commandData) {
  const handlers = {
    roarm_m2: handleM2JointsRadian,
    roarm_m3: handleM3JointsRadian,
  };
  return handlers[roarmType](command, commandData);
}

function handleJointAngleCtrl(roarmType, command, commandData) {
  const gripper = { roarm_m2: 4, roarm_m3: 6 }[roarmType];
  if (commandData[0] === gripper) {
    commandData[1] = 180 - commandData[1];
  }
  commandData[2] = (commandData[2] * 180) / 2048;
  commandData[3] = (commandData[3] * 180) / (254 * 100);
  Object.assign(command, {
    joint: commandData[0],
    angle: commandData[1],
    spd: commandData[2],
    acc: commandData[3],
  });
  return command;
}

function handleM2JointsAngle(command, commandData) {
  commandData[3] = 180 - commandData[3];
  commandData[4] = (commandData[4] * 180) / 2048;
  commandData[5] = (commandData[5] * 180) / (254 * 100);
  Object.assign(command, {
    b: commandData[0],
    s: commandData[1],
    e: commandData[2],
    h: commandData[3],
    spd: commandData[4],
    acc: commandData[5],
  });
  return command;
}

function handleM3JointsAngle(command, commandData) {
  commandData[5] = 180 - commandData[5];
  commandData[6] = (commandData[6] * 180) / 2048;
  commandData[7] = (commandData[7] * 180) / (254 * 100);
  Object.assign(command, {
    b: commandData[0],
    s: commandData[1],
    e: commandData[2],
    t: commandData[3],
    r: commandData[4],
    h: commandData[5],
    spd: commandData[6],
    acc: commandData[7],
  });
  return command;
}

function handleJointsAngleCtrl(roarmType, command, commandData) {
  const handlers = {
    roarm_m2: handleM2JointsAngle,
    roarm_m3: handleM3JointsAngle,
  };
  return handlers[roarmType](command, commandData);
}

function handleGripperModeSet(roarmType, command, commandData) {
  command.name = 'boot';
  command.step = JSON.stringify({ T: 1, mode: commandData[0] });
  return command;
}

function handleM2Pose(command, commandData) {
  commandData[3] = Math.PI - (commandData[3] * Math.PI) / 180;
  Object.assign(command, {
    x: commandData[0],
    y: commandData[1],
    z: commandData[2],
    t: commandData[3],
  });
  return command;
}

function handleM3Pose(command, commandData) {
  commandData[3] = (commandData[3] * Math.PI) / 180;
  commandData[4] = (commandData[4] * Math.PI) / 180;
  commandData[5] = Math.PI - (commandData[5] * Math.PI) / 180;
  Object.assign(command, {
    x: commandData[0],
    y: commandData[1],
    z: commandData[2],
    t: commandData[3],
    r: commandData[4],
    g: commandData[5],
  });
  return command;
}

function handlePoseCtrl(roarmType, command, commandData) {
  const handlers = {
    roarm_m2: handleM2Pose,
    roarm_m3: handleM3Pose,
  };
  return handlers[roarmType](command, commandData);
}

function handleWifiOnBoot(roarmType, command, commandData) {
  command.mode = commandData[0];
  return command;
}

function handleApOrStaSet(roarmType, command, commandData) {
  command.ssid = commandData[0];
  command.password = commandData[1];
  return command;
}

function handleApStaSet(roarmType, command, commandData) {
  command.ap_ssid = commandData[0];
  command.ap_password = commandData[1];
  command.sta_ssid = commandData[2];
  command.sta_password = commandData[3];
  return command;
}

function handleM2Feedback(validData, data) {
  validData.push(data.b, data.s, data.e);
  data.t = Math.PI - data.t;
  validData.push(data.t);
  // commented torque values skipped
  return validData;
}

function handleM3Feedback(validData, data) {
  validData.push(data.tit, data.b, data.s, data.e, data.t, data.r);
  data.g = Math.PI - data.g;
  validData.push(data.g);
  // commented torque values skipped
  return validData;
}

class DataProcessor {
  constructor(type) {
    this.type = type;
  }

  _mesg(genre, ...args) {
    const commandData = this.processDataCommand(args);
    const switchDict = {
      [JsonCmd.ECHO_SET]: handleEchoOrTorqueSet,
      [JsonCmd.MIDDLE_SET]: handleMiddleSet,
      [JsonCmd.LED_CTRL]: handleLedCtrl,
      [JsonCmd.TORQUE_SET]: handleEchoOrTorqueSet,
      [JsonCmd.DYNAMIC_ADAPTATION_SET]: handleDynamicAdaptationSet,
      [JsonCmd.JOINT_RADIAN_CTRL]: handleJointRadianCtrl,
      [JsonCmd.JOINTS_RADIAN_CTRL]: handleJointsRadianCtrl,
      [JsonCmd.JOINT_ANGLE_CTRL]: handleJointAngleCtrl,
      [JsonCmd.JOINTS_ANGLE_CTRL]: handleJointsAngleCtrl,
      [JsonCmd.GRIPPER_MODE_SET]: handleGripperModeSet,
      [JsonCmd.POSE_CTRL]: handlePoseCtrl,
      [JsonCmd.WIFI_ON_BOOT]: handleWifiOnBoot,
      [JsonCmd.AP_SET]: handleApOrStaSet,
      [JsonCmd.STA_SET]: handleApOrStaSet,
      [JsonCmd.APSTA_SET]: handleApStaSet,
      [JsonCmd.WIFI_CONFIG_CREATE_BY_INPUT]: handleApStaSet,
    };

    let command = genre ? { T: genre } : {};
    if (commandData.length > 0 && genre in switchDict) {
      command = switchDict[genre](this.type, command, commandData);
    }
    console.log(command);
    return this.flatten(command);
  }

  flatten(obj) {
    return Buffer.from(JSON.stringify(obj) + '\n');
  }

  processDataCommand(args) {
    if (!args || args.length === 0) return [];
    let processed = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        processed.push(...arg);
      } else {
        processed.push(arg);
      }
    }
    return processed;
  }

  processReceived(data, genre) {
    if (!data) return null;
    console.log('Received data:', data);

    const handlers = {
      roarm_m2: handleM2Feedback,
      roarm_m3: handleM3Feedback,
    };
    if (genre === JsonCmd.FEEDBACK_GET) {
      let validData = [data.x, data.y, data.z];
      if (this.type in handlers) {
        validData = handlers[this.type](validData, data);
      }
      return [validData];
    } else {
      return [data];
    }
  }
}

async function write(command, method = null, serialPort = null, sock = null) {
  if (method === 'http') {
    let logCommand = '';
    for (const i of command) {
      if (typeof i === 'string') {
        logCommand += i;
      } else {
        logCommand += i.toString(16) + ' ';
      }
    }
    if (sock) sock.write(command);
  } else {

    if (!serialPort) throw new Error('serialPort required for non-http write');

    let commandLog = '';
    for (const i of command) {
      if (typeof i === 'string') {
        commandLog += i.slice(2) + ' ';
      } else {
        commandLog += i.toString(16).padStart(2, '0') + ' ';
      }
    }
    console.debug('_write:', command);
    const result = await serialPort.writePort(command);

    if (result !== command.length) {
      throw new Error('writePort failed or incomplete write');
    }
  }
}

async function read(genre, serialPort, type) {
  if (genre !== JsonCmd.FEEDBACK_GET) {
    const requestDataStr = JSON.stringify({ T: 105 }) + '\n';

    if (!serialPort) throw new Error('serialPort required for read');

      const encoder = new TextEncoder();
      const requestData = encoder.encode(requestDataStr);
      const written = await serialPort.writePort(requestData);
      if (written !== requestData.length) {
        throw new Error('writePort failed or incomplete write');
      }
  }

  const baseController = new BaseController(type, serialPort);

  const data = await baseController.feedbackData();
  if (data) {
    console.debug('_read:', data);
    return data;
  }
  return null;
}


export {
  JsonCmd,
  ReadLine,
  BaseController,
  DataProcessor,
  write,
  read,
};
