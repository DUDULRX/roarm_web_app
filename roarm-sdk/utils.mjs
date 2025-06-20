// RoarmValidation.mjs

export class RoarmDataException extends Error {
  constructor(message) {
    super(message);
    this.name = "RoarmDataException";
  }
}

function checkValueType(paramType, value, expectedType) {
  if (!(value instanceof expectedType || typeof value === expectedType.name.toLowerCase())) {
    throw new RoarmDataException(
      `The acceptable parameter ${paramType} should be an ${expectedType.name}, but received ${typeof value}`
    );
  }
}

function checkCmdOrMode(paramType, value, rangeData) {
  checkValueType(paramType, value, Number);
  if (!rangeData.includes(value)) {
    throw new RoarmDataException(
      `The data supported by parameter ${paramType} is ${rangeData.join(" or ")}, but received ${value}`
    );
  }
}

function checkWifiCmd(paramType, value, rangeData) {
  checkCmdOrMode(paramType, value, rangeData);
}

function checkJoint(value, validJoints) {
  if (!validJoints.includes(value)) {
    throw new RoarmDataException(
      `The id not right, should be in ${validJoints}, but received ${value}`
    );
  }
}

function checkJointRobotLimit(value, paramType, kwargs, roarmType, paramName, robotLimit) {
  const joint = kwargs.joint;
  const index = robotLimit[roarmType].joint[joint - 1] - 1;
  const min = robotLimit[roarmType][`${paramType}_min`][index];
  const max = robotLimit[roarmType][`${paramType}_max`][index];
  if (value < min || value > max) {
    throw new RoarmDataException(`${paramName} value not right, should be ${min} ~ ${max}, but received ${value}`);
  }
}

function checkJointsRobotLimit(values, paramType, roarmType, robotLimit) {
  if (!Array.isArray(values)) {
    throw new RoarmDataException(`${paramType} must be a list.`);
  }
  const length = robotLimit[roarmType].joint.length;
  if (values.length !== length) {
    throw new RoarmDataException(`The length of ${paramType} must be ${length}.`);
  }
  for (let i = 0; i < length; i++) {
    const min = robotLimit[roarmType][`${paramType}_min`][i];
    const max = robotLimit[roarmType][`${paramType}_max`][i];
    if (values[i] < min || values[i] > max) {
      throw new RoarmDataException(
        `Has invalid ${paramType} value, error on index ${i}. Received ${values[i]} but ${paramType} should be ${min} ~ ${max}.`
      );
    }
  }
}

function checkJointSpeedAcc(paramType, value, validRange) {
  checkValueType(paramType, value, Number);
  const [min, max] = validRange;
  if (value < min || value > max) {
    console.warn(`${paramType} value not right, should be between ${min} ~ ${max}, but received ${value}.`);
  }
}

const robotLimit = {
  roarm_m2: {
    joint: [1, 2, 3, 4],
    radians_min: [-3.3, -1.9, -1.2, -0.2],
    radians_max: [3.3, 1.9, 3.3, 1.9],
    angles_min: [-190, -110, -70, -10],
    angles_max: [190, 110, 190, 100],
    positions_min: [-500, -500, 0, 0],
    positions_max: [500, 500, 600, 90],
    torques_min: [1, 1, 1, 1],
    torques_max: [1000, 1000, 1000, 1000]
  },
  roarm_m3: {
    joint: [1, 2, 3, 4, 5, 6],
    radians_min: [-3.3, -1.9, -1.2, -1.9, -3.3, -0.2],
    radians_max: [3.3, 1.9, 3.3, 1.9, 3.3, 1.9],
    angles_min: [-190, -110, -70, -110, -190, -10],
    angles_max: [190, 110, 190, 110, 190, 100],
    positions_min: [-500, -500, 0, -90, -180, 0],
    positions_max: [500, 500, 600, 90, 180, 90],
    torques_min: [1, 1, 1, 1, 1, 1],
    torques_max: [1000, 1000, 1000, 1000, 1000, 1000]
  }
};

const parameterValidations = {
  cmd: (v, t, r, k) => checkCmdOrMode("cmd", v, [0, 1]),
  mode: (v, t, r, k) => checkCmdOrMode("mode", v, [0, 1]),
  wifi_cmd: (v, t, r, k) => checkWifiCmd("wifi_cmd", v, [0, 1, 2, 3]),
  joint: (v, t, r, k) => checkJoint(v, robotLimit[r].joint),
  radian: (v, t, r, k) => checkJointRobotLimit(v, "radians", k, r, "radian", robotLimit),
  angle: (v, t, r, k) => checkJointRobotLimit(v, "angles", k, r, "angle", robotLimit),
  position: (v, t, r, k) => checkJointRobotLimit(v, "positions", k, r, "position", robotLimit),
  radians: (v, t, r, k) => checkJointsRobotLimit(v, "radians", r, robotLimit),
  angles: (v, t, r, k) => checkJointsRobotLimit(v, "angles", r, robotLimit),
  pose: (v, t, r, k) => checkJointsRobotLimit(v, "positions", r, robotLimit),
  torques: (v, t, r, k) => checkJointsRobotLimit(v, "torques", r, robotLimit),
  speed: (v, t, r, k) => checkJointSpeedAcc("speed", v, [0, 4096]),
  acc: (v, t, r, k) => checkJointSpeedAcc("acc", v, [0, 254]),
  ssid: (v, t, r, k) => checkValueType("ssid", v, String),
  password: (v, t, r, k) => checkValueType("password", v, String)
};

export function calibrationParameters(params) {
  const roarmType = params.roarm_type;
  if (!robotLimit[roarmType]) {
    throw new RoarmDataException(`Unknown roarm_type: ${roarmType}`);
  }

  for (const [key, value] of Object.entries(params)) {
    if (key === "roarm_type") continue;

    if (parameterValidations[key]) {
      const type = typeof value;
      try {
        parameterValidations[key](value, type, roarmType, params);
      } catch (err) {
        console.error(`Error in parameter ${key}:`, err.message);
        throw err;
      }
    }
  }
}

let DEFAULT_BAUDRATE = 115200;

export class PortHandler {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.isOpen = false;
    this.isUsing = false;
    this.baudrate = DEFAULT_BAUDRATE;
    this.packetStartTime = 0;
    this.packetTimeout = 0;
    this.txTimePerByte = 0;
  }
  
  async requestPort() {
    try {
      this.port = await navigator.serial.requestPort();
      return true;
    } catch (err) {
      console.error('Error requesting serial port:', err);
      return false;
    }
  }
  
  async openPort() {
    if (!this.port) {
      return false;
    }
    
    try {
      await this.port.open({ 
        baudRate: this.baudrate,  
        dataTerminalReady: false,
        requestToSend: false 
      });
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.isOpen = true;
      this.txTimePerByte = (1000.0 / this.baudrate) * 10.0;
      return true;
    } catch (err) {
      console.error('Error opening port:', err);
      return false;
    }
  }
  
  async closePort() {
    if (this.reader) {
      await this.reader.releaseLock();
      this.reader = null;
    }
    
    if (this.writer) {
      await this.writer.releaseLock();
      this.writer = null;
    }
    
    if (this.port && this.isOpen) {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await this.port.close();
      this.isOpen = false;
    }
  }
  
  async clearPort() {
    if (this.reader) {
      await this.reader.releaseLock();
      this.reader = this.port.readable.getReader();
    }
  }
  
  setBaudRate(baudrate) {
    this.baudrate = baudrate;
    this.txTimePerByte = (1000.0 / this.baudrate) * 10.0;
    return true;
  }
  
  getBaudRate() {
    return this.baudrate;
  }
  
  async writePort(data) {
    if (!this.isOpen || !this.writer) {
      return 0;
    }
    
    try {
      await this.writer.write(data);
      return data.length;
    } catch (err) {
      console.error('Error writing to port:', err);
      return 0;
    }
  }
  
  async readPort(length) {
    if (!this.isOpen || !this.reader) {
      return [];
    }
    
    try {
      // Increase timeout for more reliable data reception
      const timeoutMs = 500; 
      let totalBytes = [];
      const startTime = performance.now();
      
      // Continue reading until we get enough bytes or timeout
      while (totalBytes.length < length) {
        // Create a timeout promise
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => resolve({ value: new Uint8Array(), done: false, timeout: true }), 100); // Short internal timeout
        });
        
        // Race between reading and timeout
        const result = await Promise.race([
          this.reader.read(),
          timeoutPromise
        ]);
        
        if (result.timeout) {
          // Internal timeout - check if we've exceeded total timeout
          if (performance.now() - startTime > timeoutMs) {
            console.log(`readPort total timeout after ${timeoutMs}ms`);
            break;
          }
          continue; // Try reading again
        }
        
        if (result.done) {
          console.log('Reader done, stream closed');
          break;
        }
        
        if (result.value.length === 0) {
          // If there's no data but we haven't timed out yet, wait briefly and try again
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Check if we've exceeded total timeout
          if (performance.now() - startTime > timeoutMs) {
            console.log(`readPort total timeout after ${timeoutMs}ms`);
            break;
          }
          continue;
        }
        
        // Add received bytes to our total
        const newData = Array.from(result.value);
        totalBytes.push(...newData);
        console.log(`Read ${newData.length} bytes:`, newData.map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // If we've got enough data, we can stop
        if (totalBytes.length >= length) {
          break;
        }
      }
      
      return totalBytes;
    } catch (err) {
      console.error('Error reading from port:', err);
      return [];
    }
  }
  
  setPacketTimeout(packetLength) {
    this.packetStartTime = this.getCurrentTime();
    this.packetTimeout = (this.txTimePerByte * packetLength) + (LATENCY_TIMER * 2.0) + 2.0;
  }
  
  setPacketTimeoutMillis(msec) {
    this.packetStartTime = this.getCurrentTime();
    this.packetTimeout = msec;
  }
  
  isPacketTimeout() {
    if (this.getTimeSinceStart() > this.packetTimeout) {
      this.packetTimeout = 0;
      return true;
    }
    return false;
  }
  
  getCurrentTime() {
    return performance.now();
  }
  
  getTimeSinceStart() {
    const timeSince = this.getCurrentTime() - this.packetStartTime;
    if (timeSince < 0.0) {
      this.packetStartTime = this.getCurrentTime();
    }
    return timeSince;
  }
}

