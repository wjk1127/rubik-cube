import * as THREE from 'three';
import { CUBIE_SIZE, FACE_COLORS } from './constants.js';

const STICKER_SIZE = 0.75;
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.002;
const BASE_COLOR = 0x1a1a1a;

const FACE_PLANE_CONFIGS = {
  '+x': { pos: [ STICKER_OFFSET, 0, 0], rot: [0, Math.PI / 2, 0] },
  '-x': { pos: [-STICKER_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] },
  '+y': { pos: [0,  STICKER_OFFSET, 0], rot: [-Math.PI / 2, 0, 0] },
  '-y': { pos: [0, -STICKER_OFFSET, 0], rot: [Math.PI / 2, 0, 0] },
  '+z': { pos: [0, 0,  STICKER_OFFSET], rot: [0, 0, 0] },
  '-z': { pos: [0, 0, -STICKER_OFFSET], rot: [0, Math.PI, 0] },
};

const stickerGeom = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);

export function createCubieMesh(def) {
  const group = new THREE.Group();

  const bodyGeom = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: BASE_COLOR,
    roughness: 0.25,
    metalness: 0.15,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  for (const faceDir of def.externalFaces) {
    const cfg = FACE_PLANE_CONFIGS[faceDir];
    const stickerMat = new THREE.MeshStandardMaterial({
      color: FACE_COLORS[faceDir],
      roughness: 0.4,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const sticker = new THREE.Mesh(stickerGeom, stickerMat);
    sticker.position.set(...cfg.pos);
    sticker.rotation.set(...cfg.rot);
    sticker.receiveShadow = true;
    group.add(sticker);
  }

  const [gx, gy, gz] = def.gridPos;
  group.position.set(gx - 1, gy - 1, gz - 1);
  group.userData = { cubieId: def.id, gridPos: [gx, gy, gz] };

  return group;
}

export function createAllCubies(defs) {
  return defs.map(d => createCubieMesh(d));
}
