import * as THREE from 'three';
import { CubeModel } from './cube-model.js';
import { Renderer } from './renderer.js';
import { RotationAnimator } from './rotation-animator.js';
import { createAllCubies } from './cubie-factory.js';
import { AudioManager } from './audio.js';
import { Storage } from './storage.js';
import { ThemeManager } from './theme.js';
import { getAllCubieDefs, getLayerCubieIds, FACE_CONFIG } from './constants.js';

// ==================== 核心模块实例化 ====================

const canvas = document.getElementById('cube-canvas');
const storage = new Storage();
const theme = new ThemeManager(storage);
const renderer = new Renderer(canvas);
const model = new CubeModel();
const animator = new RotationAnimator(renderer);
const audio = new AudioManager();

const defs = getAllCubieDefs();
renderer.setCubies(createAllCubies(defs));

// 从本地存储恢复音效设置
audio.enabled = storage.get('soundEnabled');

// ==================== 游戏状态变量 ====================

let moveCount = 0;           // 当前转动步数
let moveHistory = [];        // 移动历史 [{face, direction}]，供求解回放
let gamePaused = false;      // 暂停标志
let solveInProgress = false; // 求解/打乱进行中标志

// 指针交互状态
let isDragging = false;
let pointerMoved = false;
let pointerStart = { x: 0, y: 0 };
let pointerStartTime = 0;
let touchTargetFace = null; // 按下时命中的面（用于移动端提前确定目标）

// 拖拽判定阈值（像素）和长按判定时间（毫秒）
const DRAG_THRESHOLD = 3;
const LONG_PRESS_MS = 500;

// 计时器
let timerStartTime = 0;    // performance.now() 时间戳
let timerElapsed = 0;      // 已流逝秒数（暂停时冻结）
let timerInterval = null;
let timerRunning = false;

// 缓存射线检测用的 mesh 列表（魔方重置时重建）
let raycastMeshes = [];

// 可复用的 Raycaster 实例，避免每次点击都 new
const raycaster = new THREE.Raycaster();

// ==================== DOM 元素引用 ====================

const timerEl = document.getElementById('timer');
const moveCountEl = document.getElementById('move-count');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-message');
const overlayBtn = document.getElementById('overlay-btn');
const btnSound = document.getElementById('btn-sound');

// ==================== UI 更新函数 ====================

/** 更新步数显示 */
function updateMoveDisplay() {
  moveCountEl.textContent = `步数: ${moveCount}`;
}

/** 更新计时器显示（格式 MM:SS） */
function updateTimerDisplay() {
  const total = timerRunning
    ? timerElapsed + Math.floor((performance.now() - timerStartTime) / 1000)
    : timerElapsed;
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

/** 启动计时器（首次转动时触发） */
function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerStartTime = performance.now();
  timerInterval = setInterval(updateTimerDisplay, 200); // 200ms 刷新足够平滑
}

/** 停止计时器，冻结当前已流逝时间 */
function stopTimer() {
  if (!timerRunning) return;
  timerRunning = false;
  timerElapsed += Math.floor((performance.now() - timerStartTime) / 1000);
  clearInterval(timerInterval);
  timerInterval = null;
  updateTimerDisplay();
}

/** 重置计时器 */
function resetTimer() {
  stopTimer();
  timerElapsed = 0;
  timerRunning = false;
  updateTimerDisplay();
}

/** 获取准确的总用时（秒） */
function getTotalSeconds() {
  return timerRunning
    ? timerElapsed + Math.floor((performance.now() - timerStartTime) / 1000)
    : timerElapsed;
}

// ==================== 弹窗系统 ====================

/**
 * 显示全屏遮罩弹窗
 * @param {string} title - 标题
 * @param {string} msg - 内容（支持 \n 换行）
 * @param {string} btnText - 按钮文字
 * @param {Function} callback - 按钮点击回调
 */
function showOverlay(title, msg, btnText, callback) {
  overlay.classList.remove('hidden');
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayBtn.textContent = btnText;
  overlayBtn.onclick = () => {
    overlay.classList.add('hidden');
    if (callback) callback();
  };
}

// ==================== 游戏核心逻辑 ====================

/**
 * 检测魔方是否已还原，触发通关流程
 * 在每次旋转动画完成后调用
 */
function checkSolved() {
  if (solveInProgress) return;
  if (model.isSolved() && moveCount > 0) {
    stopTimer();
    const totalSec = getTotalSeconds();
    audio.playSolve();
    storage.recordScore(totalSec, moveCount);
    const best = storage.getBest();
    let msg = `用时: ${timerEl.textContent} | 步数: ${moveCount}`;
    if (best.time !== null) {
      const bm = Math.floor(best.time / 60).toString().padStart(2, '0');
      const bs = (best.time % 60).toString().padStart(2, '0');
      msg += `\n🏆 最佳: ${bm}:${bs} | ${best.moves} 步`;
    }
    // 移动端震动反馈
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
    showOverlay('🎉 恭喜通关！', msg, '再来一局', () => doReset());
  }
}

/**
 * 执行一次面旋转（逻辑 + 动画 + 音效 + 步数）
 * @param {string} face - 'U'|'D'|'R'|'L'|'F'|'B'
 * @param {string} direction - 'cw'（顺时针）|'ccw'（逆时针）
 */
async function doMove(face, direction) {
  if (animator.isAnimating || gamePaused) return;

  // 先获取旋转前的方块 ID（必须在 model.rotateFace 之前）
  const affectedIds = getLayerCubieIds(face, model);
  // 立即更新逻辑模型
  model.rotateFace(face, direction);

  // 首次转动启动计时器
  if (!timerRunning && moveCount === 0) {
    startTimer();
  }

  moveCount++;
  moveHistory.push({ face, direction });
  updateMoveDisplay();

  audio.playMove();

  // 移动端轻震动
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  // 播放动画（逻辑模型已更新，动画仅视觉呈现）
  await animator.animate(face, direction, affectedIds, model);
  checkSolved();
}

/**
 * 打乱魔方：先重置，再执行 20 步随机序列
 */
async function doScramble() {
  if (animator.isAnimating || gamePaused) return;
  solveInProgress = true;

  doReset();
  await new Promise(r => setTimeout(r, 100));

  audio.playScramble();
  const moves = generateScramble(20);
  for (const { face, direction } of moves) {
    const affectedIds = getLayerCubieIds(face, model);
    model.rotateFace(face, direction);
    await animator.animate(face, direction, affectedIds, model);
  }
  moveCount = 0;
  moveHistory = [];
  updateMoveDisplay();
  resetTimer();
  startTimer();
  gamePaused = false;
  solveInProgress = false;
}

/**
 * 自动还原：逆序回放用户的所有操作
 */
async function doSolve() {
  if (animator.isAnimating || gamePaused || moveHistory.length === 0) return;
  solveInProgress = true;

  audio.playScramble();
  const reversed = [...moveHistory].reverse();
  for (const { face, direction } of reversed) {
    const invDir = direction === 'cw' ? 'ccw' : 'cw';
    const affectedIds = getLayerCubieIds(face, model);
    model.rotateFace(face, invDir);
    await animator.animate(face, invDir, affectedIds, model);
  }
  moveCount = 0;
  moveHistory = [];
  updateMoveDisplay();
  stopTimer();
  solveInProgress = false;
}

/**
 * 重置魔方到还原状态：重建数据模型 + 重建所有方块网格
 */
function doReset() {
  model.reset();
  const newDefs = getAllCubieDefs();
  renderer.rebuildCubies(newDefs, createAllCubies);
  rebuildRaycastCache();
  moveCount = 0;
  moveHistory = [];
  updateMoveDisplay();
  resetTimer();
  gamePaused = false;
  solveInProgress = false;
}

/**
 * 生成随机打乱序列
 * 约束：不连续两次转动同一面，不产生无效的相反面序列
 * @param {number} count - 打乱步数（默认 20）
 */
function generateScramble(count = 20) {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const opposites = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  const moves = [];
  let last = null;
  let secondLast = null;

  for (let i = 0; i < count; i++) {
    let face;
    // 回避：同面连续 / 对立面配对引发同轴连续
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
    } while (
      face === last ||
      (last && face === opposites[last] &&
        secondLast && FACE_CONFIG[face].axis === FACE_CONFIG[secondLast].axis)
    );

    // 0=CW, 1=CCW, 2=双转（两次 CW，即 180°）
    const mod = Math.floor(Math.random() * 3);
    if (mod === 2) {
      moves.push({ face, direction: 'cw' });
      moves.push({ face, direction: 'cw' });
    } else {
      moves.push({ face, direction: mod === 1 ? 'ccw' : 'cw' });
    }

    secondLast = last;
    last = face;
  }
  return moves;
}

// ==================== 暂停功能 ====================

/**
 * 暂停游戏：冻结计时器、显示遮罩
 */
function pauseGame() {
  if (moveCount === 0 && !timerRunning) return;
  gamePaused = true;
  stopTimer();
  showOverlay(
    '⏸️ 已暂停',
    `用时: ${timerEl.textContent} | 步数: ${moveCount}`,
    '继续游戏',
    () => { gamePaused = false; startTimer(); }
  );
}

// ==================== 射线检测（点击面识别） ====================

/**
 * 从射线交点解析出被点击的魔方面
 * 原理：获取交点面的世界空间法线，取绝对值最大的分量确定面方向
 */
function getFaceFromIntersect(intersect) {
  if (!intersect || !intersect.face) return null;

  const normal = intersect.face.normal.clone();
  normal.transformDirection(intersect.object.matrixWorld);
  const { x, y, z } = normal;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);

  if (ax > ay && ax > az) return x > 0 ? 'R' : 'L';
  if (ay > ax && ay > az) return y > 0 ? 'U' : 'D';
  if (az > ax && az > ay) return z > 0 ? 'F' : 'B';
  return null;
}

/** 重建射线检测缓存（重置魔方后调用） */
function rebuildRaycastCache() {
  raycastMeshes = [];
  for (const g of renderer.cubieGroups) {
    if (g.children.length > 0) raycastMeshes.push(g.children[0]);
  }
}

/**
 * 从指针事件获取点击的魔方面
 * @returns {string|null} 面名称或 null（未命中）
 */
function getIntersectedFace(e) {
  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, renderer.camera);
  const intersects = raycaster.intersectObjects(raycastMeshes, false);
  if (intersects.length === 0) return null;
  return getFaceFromIntersect(intersects[0]);
}

// 初始构建射线检测缓存
rebuildRaycastCache();

// ==================== 指针事件处理 ====================

canvas.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerStartTime = Date.now();
  pointerMoved = false;
  isDragging = true;
  // 按下时即确定目标面（移动端拖拽时不会误触发旋转）
  touchTargetFace = getIntersectedFace(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    pointerMoved = true;
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!isDragging) return;
  isDragging = false;

  // 发生了拖拽（视角旋转），忽略点击
  if (pointerMoved) { touchTargetFace = null; return; }

  // 获取目标面（优先使用按下时缓存的面）
  const face = touchTargetFace || getIntersectedFace(e);
  if (!face) return;

  // 长按或 Shift 键 → 逆时针，短按 → 顺时针
  const isLongPress = (Date.now() - pointerStartTime) > LONG_PRESS_MS || e.shiftKey;
  doMove(face, isLongPress ? 'ccw' : 'cw');
  touchTargetFace = null;
});

// 指针离开画布时重置状态
canvas.addEventListener('pointerleave', () => {
  isDragging = false;
  touchTargetFace = null;
});

// ==================== 键盘事件处理 ====================

document.addEventListener('keydown', (e) => {
  if (animator.isAnimating) return;
  const key = e.key.toUpperCase();

  // Esc：暂停/继续
  if (key === 'ESCAPE') {
    e.preventDefault();
    if (!gamePaused && (moveCount > 0 || timerRunning)) {
      pauseGame();
    } else if (gamePaused) {
      overlay.classList.add('hidden');
      gamePaused = false;
      startTimer();
    }
    return;
  }

  // P：暂停
  if (key === 'P') {
    e.preventDefault();
    if (!gamePaused && (moveCount > 0 || timerRunning)) pauseGame();
    return;
  }

  if (gamePaused) return;

  // 面旋转键：U/D/L/R/F/B，配合 Shift 逆转
  const faceMap = { 'U': 'U', 'D': 'D', 'L': 'L', 'R': 'R', 'F': 'F', 'B': 'B' };
  if (faceMap[key]) {
    e.preventDefault();
    doMove(faceMap[key], e.shiftKey ? 'ccw' : 'cw');
    return;
  }

  // 空格：打乱
  if (key === ' ') { e.preventDefault(); doScramble(); }
  // S：求解
  if (key === 'S' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doSolve(); }
});

// ==================== 按钮事件绑定 ====================

document.getElementById('btn-scramble').addEventListener('click', () => doScramble());
document.getElementById('btn-solve').addEventListener('click', () => doSolve());
document.getElementById('btn-reset').addEventListener('click', () => doReset());
document.getElementById('btn-pause').addEventListener('click', () => {
  if (!gamePaused) pauseGame();
});

// 主题切换按钮（由 ThemeManager 接管图标更新）
document.getElementById('btn-theme').addEventListener('click', () => theme.toggle());

// 音效开关
btnSound.addEventListener('click', () => {
  const enabled = audio.toggle();
  btnSound.textContent = enabled ? '🔊' : '🔇';
  storage.set('soundEnabled', enabled);
});

// ==================== 初始显示 ====================

updateMoveDisplay();
updateTimerDisplay();
