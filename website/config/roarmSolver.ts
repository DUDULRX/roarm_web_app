export namespace roarm_m2 {
  // roarm_m2 namespace as a module
  // Constants
  const ARM_L1_LENGTH_MM = 126.06;
  const ARM_L2_LENGTH_MM_A = 236.82;
  const ARM_L2_LENGTH_MM_B = 30.0;
  const ARM_L3_LENGTH_MM_A_0 = 280.15;
  const ARM_L3_LENGTH_MM_B_0 = 1.73;
  const ARM_L4_LENGTH_MM_A = 67.85;
  const ARM_L4_LENGTH_MM_B = 5.98;

  // Lengths and angles
  const l1 = ARM_L1_LENGTH_MM;
  const l2A = ARM_L2_LENGTH_MM_A;
  const l2B = ARM_L2_LENGTH_MM_B;
  const l2 = Math.sqrt(l2A * l2A + l2B * l2B);
  const t2rad = Math.atan2(l2B, l2A);

  const l3A = ARM_L3_LENGTH_MM_A_0;
  const l3B = ARM_L3_LENGTH_MM_B_0;
  const l3 = Math.sqrt(l3A * l3A + l3B * l3B);
  const t3rad = Math.atan2(l3B, l3A);

  // Angles
  let BASE_point_RAD = 0;
  let SHOULDER_point_RAD = 0;
  let ELBOW_point_RAD = Math.PI / 2;
  let EOAT_point_RAD = Math.PI;
  let EOAT_point_RAD_BUFFER = 0;

  let nanIK = false;
  let nanFK = false;
  let base_r = 0;
  let EEMode = 0;

  let EoAT_A = 0;
  let EoAT_B = 0;
  const l4A = ARM_L4_LENGTH_MM_A;
  const l4B = ARM_L4_LENGTH_MM_B;
  const lEA = EoAT_A + ARM_L4_LENGTH_MM_A;
  const lEB = EoAT_B + ARM_L4_LENGTH_MM_B;
  const lE = Math.sqrt(lEA * lEA + lEB * lEB);
  const tErad = Math.atan2(lEB, lEA);

  let initX = l3A + l2B;
  let initY = 0;
  let initZ = l2A - l3B;
  let initT = Math.PI;

  let goalX = initX;
  let goalY = initY;
  let goalZ = initZ;
  let goalT = initT;

  let lastX = goalX;
  let lastY = goalY;
  let lastZ = goalZ;
  let lastT = goalT;

  // Functions
  export function simpleLinkageIkRad(aIn: number, bIn: number): [number, number] {
    let psi: number, alpha: number, omega: number, beta: number;
    let L2C: number, LC: number, lambda: number, delta: number;
    let LA = l2;
    let LB = l3;
    if (Math.abs(bIn) < 1e-6) {
      psi = Math.acos((LA * LA + aIn * aIn - LB * LB) / (2 * LA * aIn)) + t2rad;
      alpha = Math.PI / 2.0 - psi;
      omega = Math.acos((aIn * aIn + LB * LB - LA * LA) / (2 * aIn * LB));
      beta = psi + omega - t3rad;
    } else {
      L2C = aIn * aIn + bIn * bIn;
      LC = Math.sqrt(L2C);
      lambda = Math.atan2(bIn, aIn);
      psi = Math.acos((LA * LA + L2C - LB * LB) / (2 * LA * LC)) + t2rad;
      alpha = Math.PI / 2.0 - lambda - psi;
      omega = Math.acos((LB * LB + L2C - LA * LA) / (2 * LC * LB));
      beta = psi + omega - t3rad;
    }

    delta = Math.PI / 2.0 - alpha - beta;
    SHOULDER_point_RAD = alpha;
    ELBOW_point_RAD = beta;
    EOAT_point_RAD_BUFFER = delta;

    nanIK = Number.isNaN(alpha) || Number.isNaN(beta) || Number.isNaN(delta);

    return [SHOULDER_point_RAD, ELBOW_point_RAD];
  }

  export function cartesianToPolar(x: number, y: number): [number, number] {
    let r = Math.sqrt(x * x + y * y);
    let theta = Math.atan2(y, x);
    return [r, theta];
  }

  export function polarToCartesian(r: number, theta: number): [number, number] {
    let x = r * Math.cos(theta);
    let y = r * Math.sin(theta);
    return [x, y];
  }

  export function computePosbyJointRad(
    base_joint_rad: number,
    shoulder_joint_rad: number,
    elbow_joint_rad: number,
    hand_joint_rad: number
  ): [number, number, number, number, number] {
    if (EEMode === 0) {
      let [aOut, bOut] = polarToCartesian(l2, (Math.PI / 2) - (shoulder_joint_rad + t2rad));
      let [cOut, dOut] = polarToCartesian(l3, (Math.PI / 2) - (elbow_joint_rad + shoulder_joint_rad + t3rad));

      let r_ee = aOut + cOut;
      let z_ee = bOut + dOut;

      let [eOut, fOut] = polarToCartesian(r_ee, base_joint_rad);

      lastX = eOut;
      lastY = fOut;
      lastZ = z_ee;
      lastT = hand_joint_rad; // end effector rotation placeholder
    } else if (EEMode === 1) {
      let [aOut, bOut] = polarToCartesian(
        l2,
        (Math.PI / 2) - (shoulder_joint_rad + t2rad)
      );
      let [cOut, dOut] = polarToCartesian(
        l3,
        (Math.PI / 2) - (elbow_joint_rad + shoulder_joint_rad + t3rad)
      );
      let [eOut, fOut] = polarToCartesian(
        lE,
        -(
          hand_joint_rad +
          tErad -
          Math.PI -
          (Math.PI / 2 - shoulder_joint_rad - elbow_joint_rad)
        )
      );

      let r_ee = aOut + cOut + eOut;
      let z_ee = bOut + dOut + fOut;
      let [gOut, hOut] = polarToCartesian(r_ee, base_joint_rad);

      lastX = gOut;
      lastY = hOut;
      lastZ = z_ee;
      lastT =
      hand_joint_rad - (Math.PI - shoulder_joint_rad - elbow_joint_rad) + Math.PI / 2;
    }

    return [lastX, lastY, lastZ, EEMode, lastT];
  }

  let lastValidResult: number[] = [0, 0, 0, 0, 0]; 

  export function computeJointRadbyPos(
    x: number,
    y: number,
    z: number,
    hand_joint_rad: number
  ): number[] {
    let [base_r, base_theta] = cartesianToPolar(x, y);
    let [shoulderRad, elbowRad] = simpleLinkageIkRad(base_r, z);

    const result = [base_theta, shoulderRad, elbowRad, hand_joint_rad];
    if (result.every((v) => !Number.isNaN(v))) {
        lastValidResult = result;
        return result;
    } else {
        console.warn("Inverse kinematics returned NaN. Using last valid result.");
        return lastValidResult;
    }   
  }

}

export namespace roarm_m3 {
  const ARM_L1_LENGTH_MM = 126.06;
  const ARM_L2_LENGTH_MM_A = 236.82;
  const ARM_L2_LENGTH_MM_B = 30.0;
  const ARM_L3_LENGTH_MM_A_0 = 144.49;
  const ARM_L3_LENGTH_MM_B_0 = 0;
  const ARM_L3_LENGTH_MM_A_1 = 144.49;
  const ARM_L3_LENGTH_MM_B_1 = 0;
  const ARM_L4_LENGTH_MM_A = 171.67;
  const ARM_L4_LENGTH_MM_B = 13.69;

  const l1 = ARM_L1_LENGTH_MM;
  const l2A = ARM_L2_LENGTH_MM_A;
  const l2B = ARM_L2_LENGTH_MM_B;
  const l2 = Math.sqrt(l2A * l2A + l2B * l2B);
  const t2rad = Math.atan2(l2B, l2A);
  const l3A = ARM_L3_LENGTH_MM_A_0;
  const l3B = ARM_L3_LENGTH_MM_B_0;
  const l3 = Math.sqrt(l3A * l3A + l3B * l3B);
  const t3rad = Math.atan2(l3B, l3A);
  const EoAT_A = 0;
  const EoAT_B = 0;
  const l4A = ARM_L4_LENGTH_MM_A;
  const l4B = ARM_L4_LENGTH_MM_B;
  const lEA = EoAT_A + ARM_L4_LENGTH_MM_A;
  const lEB = EoAT_B + ARM_L4_LENGTH_MM_B;
  const lE = Math.sqrt(lEA * lEA + lEB * lEB);
  const tErad = Math.atan2(lEB, lEA);

  // 机械臂状态变量，用 let 声明，方便后续更新
  let SHOULDER_JOINT_RAD = 0;
  let ELBOW_JOINT_RAD = Math.PI / 2;
  let EOAT_JOINT_RAD_BUFFER: number;

  // 其他状态变量
  let nanIK = false;
  let nanFK = false;

  // 初始化值
  let lastX = l2B + l3A + ARM_L4_LENGTH_MM_A;
  let lastY = 0;
  let lastZ = l2A - ARM_L4_LENGTH_MM_B;
  let lastT = 0;
  let lastR = 0;
  let lastG = 3.14;

  export function simpleLinkageIkRad(aIn: number, bIn: number): [number, number, number] {
    let psi: number, alpha: number, omega: number, beta: number;
    let L2C: number, LC: number, lambda: number, delta: number;
    const LA = l2;
    const LB = l3;

    if (Math.abs(bIn) < 1e-6) {
      psi = Math.acos((LA * LA + aIn * aIn - LB * LB) / (2 * LA * aIn)) + t2rad;
      alpha = Math.PI / 2 - psi;
      omega = Math.acos((aIn * aIn + LB * LB - LA * LA) / (2 * aIn * LB));
      beta = psi + omega - t3rad;
    } else {
      L2C = aIn * aIn + bIn * bIn;
      LC = Math.sqrt(L2C);
      lambda = Math.atan2(bIn, aIn);
      psi = Math.acos((LA * LA + L2C - LB * LB) / (2 * LA * LC)) + t2rad;
      alpha = Math.PI / 2 - lambda - psi;
      omega = Math.acos((LB * LB + L2C - LA * LA) / (2 * LC * LB));
      beta = psi + omega - t3rad;
    }

    delta = Math.PI / 2 - alpha - beta;

    SHOULDER_JOINT_RAD = alpha;
    ELBOW_JOINT_RAD = beta;
    EOAT_JOINT_RAD_BUFFER = delta;

    nanIK = Number.isNaN(alpha) || Number.isNaN(beta) || Number.isNaN(delta);
    return [SHOULDER_JOINT_RAD, ELBOW_JOINT_RAD, EOAT_JOINT_RAD_BUFFER];
  }

  export function rotatePoint(theta: number): [number, number] {
    const alpha = tErad + theta;
    const xB = -lE * Math.cos(alpha);
    const yB = -lE * Math.sin(alpha);
    return [xB, yB];
  }

  export function movePoint(xA: number, yA: number, s: number): [number, number] {
    const distance = Math.sqrt(xA * xA + yA * yA);
    let xB: number, yB: number;
    if (distance - s <= 1e-6) {
      xB = 0;
      yB = 0;
    } else {
      const ratio = (distance - s) / distance;
      xB = xA * ratio;
      yB = yA * ratio;
    }
    return [xB, yB];
  }

  export function cartesianToPolar(x: number, y: number): [number, number] {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return [r, theta];
  }

  export function polarToCartesian(r: number, theta: number): [number, number] {
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    return [x, y];
  }

  export function computePosbyJointRad(
    base_joint_rad: number,
    shoulder_joint_rad: number,
    elbow_joint_rad: number,
    wrist_joint_rad: number,
    roll_joint_rad: number,
    hand_joint_rad: number
  ): [number, number, number, number, number] {
    // 中间变量
    const [aOut, bOut] = polarToCartesian(l2, Math.PI / 2 - (shoulder_joint_rad + t2rad));
    const [cOut, dOut] = polarToCartesian(l3, Math.PI / 2 - (elbow_joint_rad + shoulder_joint_rad + t3rad));
    const [eOut, fOut] = polarToCartesian(lE, Math.PI / 2 - (elbow_joint_rad + shoulder_joint_rad + wrist_joint_rad + tErad));

    const r_ee = aOut + cOut + eOut;
    const z_ee = bOut + dOut + fOut;

    const [gOut, hOut] = polarToCartesian(r_ee, base_joint_rad);

    lastX = gOut;
    lastY = hOut;
    lastZ = z_ee;
    lastT = elbow_joint_rad + shoulder_joint_rad + wrist_joint_rad - Math.PI / 2;

    return [lastX, lastY, lastZ, roll_joint_rad, lastT];
  }

  let lastValidResult: number[] = [0, 0, 0, 0, 0]; 

  export function computeJointRadbyPos(
      x: number,
      y: number,
      z: number,
      roll: number,
      pitch: number,
      hand_joint_rad: number
      ): number[] {
      const delta = rotatePoint(pitch - 3.1416);
      const beta = movePoint(x, y, delta[0]);
      const bases = cartesianToPolar(beta[0], beta[1]);
      const radians = simpleLinkageIkRad(bases[0], z + delta[1]);

      const WRIST_JOINT_RAD = radians[2] + pitch;
      const ROLL_JOINT_RAD = roll;

      const result = [bases[1], radians[0], radians[1], WRIST_JOINT_RAD, ROLL_JOINT_RAD, hand_joint_rad];

      if (result.every((v) => !Number.isNaN(v))) {
          lastValidResult = result;
          return result;
      } else {
          console.warn("Inverse kinematics returned NaN. Using last valid result.");
          return lastValidResult;
      }
  }
}
