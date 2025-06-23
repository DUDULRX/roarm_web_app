import { CommandGenerator } from './generate.mjs';
import { write, read, JsonCmd, BaseController} from './common.mjs';
import { calibrationParameters, PortHandler } from './utils.mjs';
import fetch from 'node-fetch';
// // import fs from 'fs/promises';

export class Roarm extends CommandGenerator {
  constructor({
    roarm_type = null,
    baudrate = 115200,
    host = null,
    timeout = 100, // ms
    debug = false,
    thread_lock = true,
  } = {}) {
    super(roarm_type, debug);
    this.type = roarm_type;
    this.calibrationParameters = calibrationParameters;
    this.thread_lock = thread_lock;
    this.host = host || null;
    this.portHandler = null; 
    this.baudrate = baudrate;
    this.timeout = timeout;
    this.stop_flag = false;
    this.baseController = null;
    this.decode = new TextDecoder();
  }

async connect() {
  if (this.host) {
    console.log(`Connecting via host: ${this.host}`);
    // TODO: 后续实现基于 host 的通信
    return;
  }

  if (this.portHandler && this.portHandler.isOpen) {
    console.log("Already connected.");
    return true;
  }

  try{
    this.portHandler = new PortHandler();
    const portRequested = await this.portHandler.requestPort();
    if (!portRequested) {
      this.portHandler = null;
      throw new Error("Failed to select a serial port.");
    }

    this.portHandler.setBaudRate(this.baudrate);
    const portOpened = await this.portHandler.openPort();
    if (!portOpened) {
      await this.portHandler.closePort().catch(console.error); // Attempt cleanup
      this.portHandler = null;
      throw new Error(`Failed to open port at baudrate ${this.baudRate}.`);
    }
    this.baseController = new BaseController(this.type, this.portHandler);
    

  }catch (err) {
    console.error("Error during connection:", err);
    if (this.portHandler) {
      try {
        await this.portHandler.closePort();
      } catch (closeErr) {
        console.error("Error closing port after connection failure:", closeErr);
      }
    }
    this.portHandler = null;
    // Re-throw the original or a new error
    throw new Error(`Connection failed: ${err.message}`);
  }
}

  async _mesg(genre, ...args) {
    const real_command = super._mesg(genre, ...args);
    return this._res(real_command, genre);
  }

  async _res(real_command, genre) {
    let try_count = 0;
    let data = null;

    while (try_count < 10) {

      if (this.host) {
        const url = `http://${this.host}/js?json=${real_command.toString()}`;
        try {
          const response = await fetch(url);
          if (genre !== JsonCmd.FEEDBACK_GET) {
            data = real_command;
          } else {
            const text = await response.text();
            data = JSON.parse(text);
          }
        } catch (e) {
          console.warn('Network fetch error:', e);
        }
      } else {
        try {
          await write(real_command, null, this.portHandler, null);
          if (genre !== JsonCmd.FEEDBACK_GET) {
            data = JSON.parse(this.decode.decode(real_command));
          } else {
            data = await read(genre, this.portHandler, this.type, this.baseController);
          }
        } catch (e) {
          console.warn('Serial read/write error:', e);
        }
      }

      if (data !== null && data.length !== 0) break;
      try_count++;
    }

    if (try_count >= 10) return -1;

    const res = this.processReceived(data, genre);

    if (res === null) return null;
    if (Array.isArray(res) && res.length === 1) return res[0];
  }

  async breath_led(duration = 1.0, steps = 10) {
    for (let i = 0; i <= steps; i++) {
      const led = Math.floor((i / steps) * 255);
      await this.led_ctrl({ led });
      await new Promise(r => setTimeout(r, (duration / (2 * steps)) * 1000));
    }
    for (let i = 0; i <= steps; i++) {
      const led = Math.floor((1 - i / steps) * 255);
      await this.led_ctrl({ led });
      await new Promise(r => setTimeout(r, (duration / (2 * steps)) * 1000));
    }
    return 1;
  }

  async disconnect() {
    if (!this.portHandler || !this.portHandler.isOpen) {
      console.log("Already disconnected.");
      return true;
    }
    try {
      await this.portHandler.closePort();
      this.portHandler = null;
      console.log("Disconnected from serial port.");
      return true;
    } catch (err) {
      console.error("Error during disconnection:", err);
      // Attempt to nullify handlers even if close fails
      this.portHandler = null;
      throw new Error(`Disconnection failed: ${err.message}`);
    }
  }
}
