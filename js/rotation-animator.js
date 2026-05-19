import * as THREE from 'three';
import { ANIM_DURATION, FACE_CONFIG } from './constants.js';

/**
 * 旋转动画执行器
 *
 * 核心思路（Pivot-Reparent-Tween）：
 * 1. 创建临时轴心节点 pivot，放在层面几何中心
 * 2. 将受影响的 9 个方块 reparent 到 pivot（保留世界变换）
 * 3. 用 requestAnimationFrame 驱动 pivot 旋转 90°，easeInOutCubic 缓动
 * 4. 动画结束后将方块 reparent 回场景根，移除 pivot
 *
 * 逻辑状态在动画开始前就已更新（参见 main.js 的 doMove），
 * 动画仅负责视觉呈现，两者解耦。
 */
export class RotationAnimator {
  constructor(renderer) {
    this.renderer = renderer;
    this.isAnimating = false; // 是否正在播放动画
    this.queue = [];           // 动画队列（快速点击时不丢输入）
  }

  /**
   * 为指定面创建轴心节点
   * U 面 pivot 在 (0, 1, 0)，D 面在 (0, -1, 0)，依此类推
   */
  getPivot(face) {
    const cfg = FACE_CONFIG[face];
    const pivot = new THREE.Object3D();
    const offset = cfg.layer - 1; // layer=2 → offset=1, layer=0 → offset=-1
    switch (cfg.axis) {
      case 'x': pivot.position.set(offset, 0, 0); break;
      case 'y': pivot.position.set(0, offset, 0); break;
      case 'z': pivot.position.set(0, 0, offset); break;
    }
    return pivot;
  }

  /**
   * 对外入口：如果正在动画中则入队，否则立即执行
   * @returns {Promise} 动画完成时 resolve
   */
  animate(face, direction, affectedIds, model) {
    if (this.isAnimating) {
      return new Promise(resolve => {
        this.queue.push({ face, direction, affectedIds, model, resolve });
      });
    }
    this.isAnimating = true;
    return this._doAnimate(face, direction, affectedIds, model);
  }

  /**
   * 内部动画执行
   * @param {string} face - 面名称
   * @param {string} direction - 'cw' | 'ccw'
   * @param {number[]} affectedIds - 受影响的方块 ID 列表
   * @param {CubeModel} model - 魔方逻辑模型
   */
  _doAnimate(face, direction, affectedIds, model) {
    return new Promise(resolve => {
      const cfg = FACE_CONFIG[face];
      const pivot = this.getPivot(face);
      this.renderer.cubeRoot.add(pivot);

      // 旋转轴单位向量
      const axisVec = new THREE.Vector3(
        cfg.axis === 'x' ? 1 : 0,
        cfg.axis === 'y' ? 1 : 0,
        cfg.axis === 'z' ? 1 : 0
      );

      // 将受影响的方块挂到 pivot 下，保留世界变换
      for (const id of affectedIds) {
        const group = this.renderer.getCubieGroup(id);
        if (!group) continue;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        group.getWorldPosition(worldPos);
        group.getWorldQuaternion(worldQuat);
        // attach() 自动保留世界变换
        pivot.attach(group);
        group.position.copy(worldPos).sub(pivot.position);
        group.quaternion.copy(worldQuat);
      }

      const angle = direction === 'cw' ? cfg.cwAngle : -cfg.cwAngle;
      const startTime = performance.now();
      const startQuat = pivot.quaternion.clone();
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / ANIM_DURATION, 1);
        // easeInOutCubic = 1 - (1-t)³，带来自然的减速停止
        const eased = 1 - (1 - t) ** 3;
        pivot.quaternion.copy(startQuat).slerp(targetQuat, eased);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          // 动画完成：确保精确最终角度
          pivot.quaternion.copy(startQuat).multiply(targetQuat);

          // 将方块移回场景根，保留世界变换
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

          // 同步逻辑模型的朝向
          model.updateOrientations(face, direction);

          this.isAnimating = false;

          // 处理动画队列
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
