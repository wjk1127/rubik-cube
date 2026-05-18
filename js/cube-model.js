import * as THREE from 'three';
import { getAllCubieDefs, posKey, buildRotationMap, FACE_CONFIG } from './constants.js';

export class CubeModel {
  constructor() {
    this.grid = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => Array(3).fill(-1))
    );
    this.orientation = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => Array(3).fill(null))
    );
    this.cubieDefs = new Map();
    this._init();
  }

  _init() {
    const defs = getAllCubieDefs();
    for (const def of defs) {
      const [x, y, z] = def.gridPos;
      this.grid[x][y][z] = def.id;
      this.orientation[x][y][z] = new THREE.Quaternion().identity();
      this.cubieDefs.set(def.id, { ...def });
    }
  }

  rotateFace(face, direction) {
    const map = buildRotationMap(face, direction);

    const oldGrid = {};
    const oldOrient = {};
    for (const { from } of map) {
      const [fx, fy, fz] = from;
      oldGrid[posKey(fx, fy, fz)] = this.grid[fx][fy][fz];
      oldOrient[posKey(fx, fy, fz)] = this.orientation[fx][fy][fz].clone();
    }

    const result = [];
    for (const { from, to } of map) {
      const [fx, fy, fz] = from;
      const [tx, ty, tz] = to;
      const fromKey = posKey(fx, fy, fz);
      result.push({
        id: oldGrid[fromKey],
        fromPos: [fx, fy, fz],
        toPos: [tx, ty, tz],
      });
    }

    for (const { from, to } of map) {
      const [fx, fy, fz] = from;
      const [tx, ty, tz] = to;
      const fromKey = posKey(fx, fy, fz);
      this.grid[tx][ty][tz] = oldGrid[fromKey];
      this.orientation[tx][ty][tz] = oldOrient[fromKey];
    }

    return result;
  }

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

  isSolved() {
    const defs = getAllCubieDefs();
    for (const def of defs) {
      const [x, y, z] = def.gridPos;
      if (this.grid[x][y][z] !== def.id) return false;
      if (!this.orientation[x][y][z].equals(new THREE.Quaternion())) return false;
    }
    return true;
  }

  reset() {
    this._init();
  }
}
