// 方块尺寸（边长），单位与世界坐标一致
export const CUBIE_SIZE = 0.85;

// 方块间缝隙宽度
export const CUBIE_GAP = 0.15;

// 旋转动画时长（毫秒）
export const ANIM_DURATION = 250;

// 六面颜色映射：以世界坐标轴方向为键
// +x 右面(红) -x 左面(橙) +y 顶面(白) -y 底面(黄) +z 前面(绿) -z 后面(蓝)
export const FACE_COLORS = {
  '+x': 0xff4444,
  '-x': 0xff8800,
  '+y': 0xffffff,
  '-y': 0xffdd00,
  '+z': 0x00cc44,
  '-z': 0x2266ff,
};

// 六面名称列表
export const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];

/**
 * 每个面的旋转配置：
 *   axis    — 旋转轴 ('x'|'y'|'z')
 *   layer   — 该面所在层的网格坐标 (0|2)
 *   cwAngle — 顺时针旋转角度（弧度），CW 定义为"从外部看向该面时的顺时针"
 *
 * 角度推导：
 *   U/D CW = -90° 绕 Y（从+Y看向立方体，顺时针 = -π/2）
 *   R/L CW = +90° 绕 X
 *   F   CW = -90° 绕 Z
 *   B   CW = +90° 绕 Z（从-Z看向立方体，顺时针 = +π/2）
 */
export const FACE_CONFIG = {
  U: { axis: 'y', layer: 2, cwAngle: -Math.PI / 2 },
  D: { axis: 'y', layer: 0, cwAngle: -Math.PI / 2 },
  R: { axis: 'x', layer: 2, cwAngle:  Math.PI / 2 },
  L: { axis: 'x', layer: 0, cwAngle:  Math.PI / 2 },
  F: { axis: 'z', layer: 2, cwAngle: -Math.PI / 2 },
  B: { axis: 'z', layer: 0, cwAngle:  Math.PI / 2 },
};

/**
 * 获取某个面所在层的全部 9 个网格坐标
 * 例如 U 面(axis='y', layer=2) 返回 [[0,2,0], [1,2,0], [2,2,0], [0,2,1], ...]
 */
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

/**
 * 计算某个网格坐标绕指定面旋转后的新坐标
 * 原理：将坐标平移到原点（-1），应用 3D 旋转矩阵，再平移回来（+1）
 * 使用 Math.round 消除浮点误差，确保结果精确为 0/1/2
 */
function rotatePos(pos, face, dir) {
  const angle = dir === 'cw' ? FACE_CONFIG[face].cwAngle : -FACE_CONFIG[face].cwAngle;
  const axis = FACE_CONFIG[face].axis;

  // 平移到以 1,1,1 为原点的坐标系
  const ox = pos[0] - 1;
  const oy = pos[1] - 1;
  const oz = pos[2] - 1;

  let rx, ry, rz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // 根据旋转轴应用对应的旋转矩阵（仅需 ±90°，cos=0, sin=±1）
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

/**
 * 构建一个面旋转的完整置换映射表
 * 返回 [{from: [x,y,z], to: [x,y,z]}, ...] 共 9 项
 */
export function buildRotationMap(face, dir) {
  const positions = getLayerPositions(face);
  return positions.map(from => ({
    from,
    to: rotatePos(from, face, dir),
  }));
}

/**
 * 获取某个面当前层上所有 9 个方块的 ID 列表
 * 必须在 model.rotateFace() 之前调用，以获取旋转前的方块分布
 */
export function getLayerCubieIds(face, model) {
  const ids = [];
  const cfg = FACE_CONFIG[face];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let x, y, z;
      switch (cfg.axis) {
        case 'x': x = cfg.layer; y = i; z = j; break;
        case 'y': x = i; y = cfg.layer; z = j; break;
        case 'z': x = i; y = j; z = cfg.layer; break;
      }
      ids.push(model.grid[x][y][z]);
    }
  }
  return ids;
}

/**
 * 生成全部 26 个方块的定义（初始状态）
 * 跳过核心坐标 [1,1,1]（三阶魔方中心没有方块）
 * externalFaces 记录该方块哪些面是朝外的，用于贴纸生成
 */
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

/** 将网格坐标转为字符串 key，用于临时字典存储 */
export function posKey(x, y, z) {
  return `${x},${y},${z}`;
}
