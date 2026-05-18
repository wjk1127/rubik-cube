import * as THREE from 'three';
import { UNIT, ANIM_DURATION, FACE_CONFIG } from './constants.js';

export class RotationAnimator {
  constructor(renderer) {
    this.renderer = renderer;
    this.isAnimating = false;
    this.queue = [];
  }

  getPivot(face) {
    const cfg = FACE_CONFIG[face];
    const pivot = new THREE.Object3D();
    const offset = cfg.layer - 1;
    switch (cfg.axis) {
      case 'x': pivot.position.set(offset, 0, 0); break;
      case 'y': pivot.position.set(0, offset, 0); break;
      case 'z': pivot.position.set(0, 0, offset); break;
    }
    return pivot;
  }

  animate(face, direction, affectedIds, model) {
    if (this.isAnimating) {
      return new Promise(resolve => {
        this.queue.push({ face, direction, affectedIds, model, resolve });
      });
    }

    this.isAnimating = true;
    return this._doAnimate(face, direction, affectedIds, model);
  }

  _doAnimate(face, direction, affectedIds, model) {
    return new Promise(resolve => {
      const cfg = FACE_CONFIG[face];
      const pivot = this.getPivot(face);
      this.renderer.cubeRoot.add(pivot);

      const axisVec = new THREE.Vector3(
        cfg.axis === 'x' ? 1 : 0,
        cfg.axis === 'y' ? 1 : 0,
        cfg.axis === 'z' ? 1 : 0
      );

      for (const id of affectedIds) {
        const group = this.renderer.getCubieGroup(id);
        if (!group) continue;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        group.getWorldPosition(worldPos);
        group.getWorldQuaternion(worldQuat);
        pivot.attach(group);
        group.position.copy(worldPos).sub(pivot.position);
        group.quaternion.copy(worldQuat);
      }

      const angle = direction === 'cw' ? cfg.cwAngle : -cfg.cwAngle;
      const targetAngle = angle;
      const startTime = performance.now();
      const startQuat = pivot.quaternion.clone();
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, targetAngle);

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / ANIM_DURATION, 1);
        const eased = 1 - (1 - t) ** 3;

        pivot.quaternion.copy(startQuat).slerp(targetQuat, eased);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          pivot.quaternion.copy(startQuat).multiply(targetQuat);

          while (pivot.children.length > 0) {
            const child = pivot.children[0];
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            child.getWorldPosition(worldPos);
            child.getWorldQuaternion(worldQuat);
            this.renderer.cubeRoot.attach(child);
            child.position.copy(worldPos);
            child.quaternion.copy(worldQuat);
          }

          this.renderer.cubeRoot.remove(pivot);

          model.updateOrientations(face, direction);

          this.isAnimating = false;

          if (this.queue.length > 0) {
            const next = this.queue.shift();
            this._doAnimate(next.face, next.direction, next.affectedIds, next.model)
              .then(next.resolve);
          }

          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }
}
