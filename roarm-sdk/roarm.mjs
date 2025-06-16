import { CommandGenerator } from './generate.mjs';
import { write, read, JsonCmd } from './common.mjs';
import { calibrationParameters, PortHandler } from './utils.mjs';
import fetch from 'node-fetch';
// import fs from 'fs/promises';

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
    // if (!this.host && this.port == null) {
    //   this.portHandler = new PortHandler();
    //   this.portHandler.setBaudRate(this.baudrate);
    // }

    // if (!this.portHandler) throw new Error('PortHandler not initialized');

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
    const real_command = super._mesg(genre, ...args);
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

  listen_for_input() {
    console.log('Call roarm.stop_flag = true manually to stop data collection.');
  }

  async drag_teach_start(filename) {
    await this.torque_set(0);
    const data = [];
    console.log('Starting data collection.');
    this.stop_flag = false;
    this.listen_for_input();

    while (!this.stop_flag) {
      const radians = await this.joints_radian_get();
      data.push({
        timestamped: Date.now() / 1000,
        radians,
      });
      await new Promise(r => setTimeout(r, 100));
    }

    try {
      // await fs.writeFile(filename, JSON.stringify(data, null, 4), 'utf8');
      console.log(`Data saved. Total ${data.length} records.`);
    } catch (e) {
      console.error('Error saving data:', e);
    }
  }

  async drag_teach_replay(filename) {
    let data;
    try {
      // const content = await fs.readFile(filename, 'utf8');
      data = JSON.parse(content);
    } catch (e) {
      console.error('Error reading file:', e);
      return;
    }

    if (!Array.isArray(data) || data.length < 2) {
      console.error('Not enough data to replay.');
      return;
    }

    const switch_dict = {
      roarm_m2: [0, 0, 0, 0],
      roarm_m3: [0, 0, 0, 0, 0, 0],
    };

    let prev_speed = switch_dict[this.type] || [];

    for (let i = 1; i < data.length; i++) {
      const r1 = data[i - 1];
      const r2 = data[i];
      const dt = r2.timestamped - r1.timestamped;
      if (dt <= 0) continue;

      const diff = r2.radians.map((r, idx) => r - r1.radians[idx]);
      const vel = diff.map(d => d / dt);
      const speed = vel.map(v => Math.abs(Math.floor((v * 2048) / Math.PI)));
      const acc = speed.map((s, idx) => Math.abs(Math.floor((s - (prev_speed[idx] || 0)) / (100 * dt))));

      for (let joint = 0; joint < prev_speed.length; joint++) {
        if (speed[joint] !== 0) {
          await this.joint_radian_ctrl({
            joint: joint + 1,
            radian: r2.radians[joint],
            speed: speed[joint],
            acc: acc[joint],
          });
          await new Promise(r => setTimeout(r, dt * 1000));
        }
      }
      prev_speed = speed;
    }

    console.log(`Replayed ${data.length} steps from ${filename}.`);
  }

  async disconnect() {
    if (this.portHandler && this.portHandler.isOpen) {
      await this.portHandler.closePort();
    }
  }
}
