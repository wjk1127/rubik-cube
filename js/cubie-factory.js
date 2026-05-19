import * as THREE from 'three';
import { CUBIE_SIZE, FACE_COLORS } from './constants.js';

// 贴纸尺寸（略小于方块面，形成黑边效果）
const STICKER_SIZE = 0.75;
// 贴纸距方块中心的偏移量（方块半边长 + 微量偏移避免 z-fighting）
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.002;
// 方块本体颜色（黑灰色，模拟魔方塑料底座）
const BASE_COLOR = 0x1a1a1a;

/**
 * 六面贴纸的放置配置
 * pos: 贴纸在方块局部坐标中的位置
 * rot: 贴纸平面的旋转角度（使其平行于对应面）
 */
const FACE_PLANE_CONFIGS = {
  '+x': { pos: [ STICKER_OFFSET, 0, 0], rot: [0, Math.PI / 2, 0] },
  '-x': { pos: [-STICKER_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] },
  '+y': { pos: [0,  STICKER_OFFSET, 0], rot: [-Math.PI / 2, 0, 0] },
  '-y': { pos: [0, -STICKER_OFFSET, 0], rot: [Math.PI / 2, 0, 0] },
  '+z': { pos: [0, 0,  STICKER_OFFSET], rot: [0, 0, 0] },
  '-z': { pos: [0, 0, -STICKER_OFFSET], rot: [0, Math.PI, 0] },
};

// 共享的贴纸几何体（所有方块复用，节省 GPU 内存）
const stickerGeom = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);

// 共享的方块本体几何体
const bodyGeom = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);

// 按颜色缓存材质，避免为每个方块重复创建
const materialCache = new Map();
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: BASE_COLOR,
  roughness: 0.25,
  metalness: 0.15,
});

/**
 * 获取或创建指定颜色的贴纸材质（带缓存）
 */
function getStickerMaterial(colorHex) {
  if (materialCache.has(colorHex)) return materialCache.get(colorHex);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.4,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  materialCache.set(colorHex, mat);
  return mat;
}

/**
 * 创建一个方块（Group = 黑色本体 + N 个彩色贴纸平面）
 * @param {Object} def - 方块定义 { id, gridPos: [x,y,z], externalFaces: ['+x',...] }
 * @returns {THREE.Group} 方块的三维对象
 */
export function createCubieMesh(def) {
  const group = new THREE.Group();

  // 黑色本体
  const body = new THREE.Mesh(bodyGeom, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 按需为每个朝外面添加彩色贴纸
  for (const faceDir of def.externalFaces) {
    const cfg = FACE_PLANE_CONFIGS[faceDir];
    const sticker = new THREE.Mesh(stickerGeom, getStickerMaterial(FACE_COLORS[faceDir]));
    sticker.position.set(...cfg.pos);
    sticker.rotation.set(...cfg.rot);
    sticker.receiveShadow = true;
    group.add(sticker);
  }

  // 世界坐标 = 网格坐标 - 1（使立方体中心在原点）
  const [gx, gy, gz] = def.gridPos;
  group.position.set(gx - 1, gy - 1, gz - 1);
  group.userData = { cubieId: def.id, gridPos: [gx, gy, gz] };

  return group;
}

/** 批量创建全部 26 个方块 */
export function createAllCubies(defs) {
  return defs.map(d => createCubieMesh(d));
}
