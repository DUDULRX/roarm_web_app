import { Roarm } from "roarm-sdk";

let roarm = null;

export function initRoarm(robotName, baudrate) {
  roarm = new Roarm({ roarm_type: robotName, baudrate: baudrate});
  console.log("initRoarm", roarm);
  return roarm;
}

export function getRoarm() {
  console.log("getRoarm", roarm);
  return roarm;
}