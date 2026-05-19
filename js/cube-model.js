import * as THREE from 'three';
import { getAllCubieDefs, posKey, buildRotationMap, FACE_CONFIG } from './constants.js';

/**
 * 魔方逻辑状态管理器
 *
 * 核心数据结构：
 *   grid[x][y][z]        — 该网格位置当前是哪个方块（cubieId），-1 表示空（仅核心[1,1,1]）
 *   orientation[x][y][z] — 该位置方块的朝向四元数（THREE.Quaternion）
 *
 * 关键设计：方块本身颜色不变，通过朝向四元数改变其可见面颜色。
 * 例如：UFR 角的红面(+x)在经过 U 旋转后可能朝向 -z（背面），
 * 这样视觉上背面就会出现红色贴纸，正确地模拟了魔方转动。
 */
export class CubeModel {
  constructor() {
    // 3×3×3 网格，初始化为 -1（空）
    this.grid = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => Array(3).fill(-1))
    );
    // 3×3×3 朝向数组，初始化为 null
    this.orientation = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => Array(3).fill(null))
    );
    this.cubieDefs = new Map();
    this._init();
  }

  /** 初始化为还原状态：每个方块在其原始位置，朝向为单位四元数 */
  _init() {
    const defs = getAllCubieDefs();
    for (const def of defs) {
      const [x, y, z] = def.gridPos;
      this.grid[x][y][z] = def.id;
      this.orientation[x][y][z] = new THREE.Quaternion().identity();
      this.cubieDefs.set(def.id, { ...def });
    }
  }

  /**
   * 执行层面旋转（仅更新逻辑状态，不处理动画）
   * @param {string} face - 面名称 'U'|'D'|'R'|'L'|'F'|'B'
   * @param {string} direction - 旋转方向 'cw'（顺时针）|'ccw'（逆时针）
   * @returns {Array} 受影响的方块列表 [{id, fromPos, toPos}]，供动画使用
   *
   * 实现：先保存整层 9 个位置的数据，再按置换映射表循环写入新位置
   */
  rotateFace(face, direction) {
    const map = buildRotationMap(face, direction);

    // 先暂存旋转前该层所有位置的方块 ID 和朝向
    const oldGrid = {};
    const oldOrient = {};
    for (const { from } of map) {
      const [fx, fy, fz] = from;
      oldGrid[posKey(fx, fy, fz)] = this.grid[fx][fy][fz];
      oldOrient[posKey(fx, fy, fz)] = this.orientation[fx][fy][fz].clone();
    }

    // 构建返回结果
    const result = [];
    for (const { from, to } of map) {
      const [fx, fy, fz] = from;
      const fromKey = posKey(fx, fy, fz);
      result.push({
        id: oldGrid[fromKey],
        fromPos: [fx, fy, fz],
        toPos: [...to],
      });
    }

    // 按置换表写入新位置
    for (const { from, to } of map) {
      const [fx, fy, fz] = from;
      const [tx, ty, tz] = to;
      const fromKey = posKey(fx, fy, fz);
      this.grid[tx][ty][tz] = oldGrid[fromKey];
      this.orientation[tx][ty][tz] = oldOrient[fromKey];
    }

    return result;
  }

  /**
   * 更新层面所有方块的朝向（在动画完成后调用）
   * 将旋转四元数 q 左乘到每个方块的当前朝向上：newOrient = q × oldOrient
   */
  updateOrientations(face, direction) {
    const cfg = FACE_CONFIG[face];
    const angle = direction === 'cw' ? cfg.cwAngle : -cfg.cwAngle;
    const q = new THREE.Quaternion();
    switch (cfg.axis) {
      case 'x': q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle); break;
      case 'y': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle); break;
      case 'z': q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle); break;
    }

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let x, y, z;
        switch (cfg.axis) {
          case 'x': x = cfg.layer; y = i; z = j; break;
          case 'y': x = i; y = cfg.layer; z = j; break;
          case 'z': x = i; y = j; z = cfg.layer; break;
        }
        const cur = this.orientation[x][y][z].clone();
        this.orientation[x][y][z].multiplyQuaternions(q, cur);
      }
    }
  }

  /**
   * 判定魔方是否已还原
   * 条件：每个方块都在其原始位置，且朝向为单位四元数（未旋转）
   */
  isSolved() {
    const defs = getAllCubieDefs();
    for (const def of defs) {
      const [x, y, z] = def.gridPos;
      if (this.grid[x][y][z] !== def.id) return false;
      if (!this.orientation[x][y][z].equals(new THREE.Quaternion())) return false;
    }
    return true;
  }

  /** 重置为还原状态 */
  reset() {
    this._init();
  }
}
