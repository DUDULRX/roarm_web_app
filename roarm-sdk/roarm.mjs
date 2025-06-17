import { CommandGenerator } from './generate.mjs';
import { write, read, JsonCmd } from './common.mjs';
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
    this.port = null;
    this.baudrate = baudrate;
    this.timeout = timeout;
    this.stop_flag = false;
    this._write = write;
    this._read = read;
    this.portHandler = null; 
  }

  async connect() {
    if (this.host) {
      console.log(`Connecting via host: ${this.host}`);
      return;
    }

    this.portHandler = new PortHandler();
    this.portHandler.setBaudRate(this.baudrate);

    const granted = await this.portHandler.requestPort();
    if (!granted) {
      throw new Error('Serial port access denied');
    }

    const opened = await this.portHandler.openPort();
    if (!opened) {
      throw new Error('Failed to open serial port');
    }
  }

  async _mesg(genre, ...args) {
    // const real_command = super._mesg(genre, ...args);
    console.log(genre, ...args)
    return this._res(real_command, genre);
  }

  async _res(real_command, genre) {
    let try_count = 0;
    while (try_count < 10) {
      let data = null;

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
          await this._write(real_command);
          if (genre !== JsonCmd.FEEDBACK_GET) {
            data = real_command;
          } else {
            data = await this._read(genre);
          }
        } catch (e) {
          console.warn('Serial read/write error:', e);
        }
      }

      if (data !== null && data.length !== 0) break;
      try_count++;
    }

    if (try_count >= 10) return -1;

    const res = this._process_received(data, genre);
    if (res === null) return null;
    if (Array.isArray(res) && res.length === 1) return res[0];
    return res;
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
    if (this.portHandler && this.portHandler.isOpen) {
      await this.portHandler.closePort();
    }
  }
}
