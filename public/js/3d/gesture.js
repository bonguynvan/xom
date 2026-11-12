// Small movements added to a skinned character after its mixer has written the pose: turning one bone about
// an axis given in the world, and the greeting wave. Shared by your avatar and the neighbours who wave back.
import * as THREE from '../vendor/three/three.module.min.js';

const parentQ = new THREE.Quaternion();
const turn = new THREE.Quaternion();
const facing = new THREE.Quaternion();
const fwd = new THREE.Vector3();

/** Turn bone `b` by `angle` about `axis` (a unit vector in the world), on top of whatever pose it has. */
export function swing(b, axis, angle) {
  b.parent.getWorldQuaternion(parentQ);
  turn.setFromAxisAngle(axis, angle);
  b.quaternion.premultiply(parentQ.clone().invert().multiply(turn).multiply(parentQ));
}

/**
 * Raise the right arm and wave the forearm. `body` is the object whose +Z is the way the character faces,
 * `amount` 0..1 how far the arm is up, `clock` seconds (the wave's rhythm).
 */
export function waveArm(body, arm, fore, amount, clock) {
  if (amount < 0.01 || !arm || !fore) return;
  body.updateMatrixWorld(true);
  fwd.set(0, 0, 1).applyQuaternion(body.getWorldQuaternion(facing));
  swing(arm, fwd, -2.25 * amount);
  arm.updateMatrixWorld(true);
  swing(fore, fwd, (0.55 + Math.sin(clock * 9) * 0.45) * amount);
}
