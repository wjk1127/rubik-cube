export const CUBIE_SIZE = 0.85;
export const CUBIE_GAP = 0.15;
export const UNIT = CUBIE_SIZE + CUBIE_GAP;

export const ANIM_DURATION = 250;

export const FACE_COLORS = {
  '+x': 0xff4444,
  '-x': 0xff8800,
  '+y': 0xffffff,
  '-y': 0xffdd00,
  '+z': 0x00cc44,
  '-z': 0x2266ff,
};

export const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];

export const FACE_CONFIG = {
  U: { axis: 'y', layer: 2, cwAngle: -Math.PI / 2 },
  D: { axis: 'y', layer: 0, cwAngle: -Math.PI / 2 },
  R: { axis: 'x', layer: 2, cwAngle:  Math.PI / 2 },
  L: { axis: 'x', layer: 0, cwAngle:  Math.PI / 2 },
  F: { axis: 'z', layer: 2, cwAngle: -Math.PI / 2 },
  B: { axis: 'z', layer: 0, cwAngle:  Math.PI / 2 },
};

function isOnLayer(pos, face) {
  const cfg = FACE_CONFIG[face];
  switch (cfg.axis) {
    case 'x': return pos[0] === cfg.layer;
    case 'y': return pos[1] === cfg.layer;
    case 'z': return pos[2] === cfg.layer;
  }
}

function getLayerPositions(face) {
  const cfg = FACE_CONFIG[face];
  const positions = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let pos;
      switch (cfg.axis) {
        case 'x': pos = [cfg.layer, i, j]; break;
        case 'y': pos = [i, cfg.layer, j]; break;
        case 'z': pos = [i, j, cfg.layer]; break;
      }
      positions.push(pos);
    }
  }
  return positions;
}

function rotatePos(pos, face, dir) {
  const angle = dir === 'cw' ? FACE_CONFIG[face].cwAngle : -FACE_CONFIG[face].cwAngle;
  const axis = FACE_CONFIG[face].axis;

  const ox = pos[0] - 1;
  const oy = pos[1] - 1;
  const oz = pos[2] - 1;

  let rx, ry, rz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  switch (axis) {
    case 'x':
      rx = ox;
      ry = Math.round(oy * cos - oz * sin);
      rz = Math.round(oy * sin + oz * cos);
      break;
    case 'y':
      rx = Math.round(ox * cos + oz * sin);
      ry = oy;
      rz = Math.round(-ox * sin + oz * cos);
      break;
    case 'z':
      rx = Math.round(ox * cos - oy * sin);
      ry = Math.round(ox * sin + oy * cos);
      rz = oz;
      break;
  }

  return [rx + 1, ry + 1, rz + 1];
}

export function buildRotationMap(face, dir) {
  const positions = getLayerPositions(face);
  return positions.map(from => ({
    from,
    to: rotatePos(from, face, dir),
  }));
}

export function getLayerCubieIds(face, model) {
  const ids = [];
  const layer = FACE_CONFIG[face].layer;
  const axis = FACE_CONFIG[face].axis;

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let x, y, z;
      switch (axis) {
        case 'x': x = layer; y = i; z = j; break;
        case 'y': x = i; y = layer; z = j; break;
        case 'z': x = i; y = j; z = layer; break;
      }
      ids.push(model.grid[x][y][z]);
    }
  }
  return ids;
}

export function getAllCubieDefs() {
  const defs = [];
  let id = 0;
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        if (x === 1 && y === 1 && z === 1) continue;
        const faces = [];
        if (x === 0) faces.push('-x');
        if (x === 2) faces.push('+x');
        if (y === 0) faces.push('-y');
        if (y === 2) faces.push('+y');
        if (z === 0) faces.push('-z');
        if (z === 2) faces.push('+z');
        defs.push({ id, gridPos: [x, y, z], externalFaces: faces });
        id++;
      }
    }
  }
  return defs;
}

export function posKey(x, y, z) {
  return `${x},${y},${z}`;
}
