import * as THREE from 'three';
import { CubeModel } from './cube-model.js';
import { Renderer } from './renderer.js';
import { RotationAnimator } from './rotation-animator.js';
import { createAllCubies } from './cubie-factory.js';
import { AudioManager } from './audio.js';
import { Storage } from './storage.js';
import { ThemeManager } from './theme.js';
import { getAllCubieDefs, getLayerCubieIds, FACE_CONFIG } from './constants.js';

const canvas = document.getElementById('cube-canvas');
const storage = new Storage();
const theme = new ThemeManager(storage);
const renderer = new Renderer(canvas);
const model = new CubeModel();
const animator = new RotationAnimator(renderer);
const audio = new AudioManager();

const defs = getAllCubieDefs();
renderer.setCubies(createAllCubies(defs));

audio.enabled = storage.get('soundEnabled');

let moveCount = 0;
let moveHistory = [];
let isDragging = false;
let pointerMoved = false;
let pointerStart = { x: 0, y: 0 };
let pointerStartTime = 0;
let touchTargetFace = null;
let gamePaused = false;
const DRAG_THRESHOLD = 3;
const LONG_PRESS_MS = 500;

const timerEl = document.getElementById('timer');
const moveCountEl = document.getElementById('move-count');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-message');
const overlayBtn = document.getElementById('overlay-btn');
const btnSound = document.getElementById('btn-sound');

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function updateMoveDisplay() {
  moveCountEl.textContent = `步数: ${moveCount}`;
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
}

function pauseGame() {
  if (moveCount === 0 && !timerRunning) return;
  gamePaused = true;
  stopTimer();
  showOverlay(
    '⏸️ 已暂停',
    `用时: ${timerEl.textContent} | 步数: ${moveCount}`,
    '继续游戏',
    () => {
      gamePaused = false;
      startTimer();
    }
  );
}

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

function checkSolved() {
  if (model.isSolved() && moveCount > 0) {
    stopTimer();
    audio.playSolve();
    storage.recordScore(timerSeconds, moveCount);
    const best = storage.getBest();
    let msg = `用时: ${timerEl.textContent} | 步数: ${moveCount}`;
    if (best.time !== null) {
      const bm = Math.floor(best.time / 60).toString().padStart(2, '0');
      const bs = (best.time % 60).toString().padStart(2, '0');
      msg += `\n🏆 最佳: ${bm}:${bs} | ${best.moves} 步`;
    }
    showOverlay('🎉 恭喜通关！', msg, '再来一局', () => doReset());
  }
}

async function doMove(face, direction) {
  if (animator.isAnimating || gamePaused) return;

  const affectedIds = getLayerCubieIds(face, model);
  model.rotateFace(face, direction);

  if (!timerRunning && moveCount === 0) {
    startTimer();
  }

  moveCount++;
  moveHistory.push({ face, direction });
  updateMoveDisplay();

  audio.playMove();
  await animator.animate(face, direction, affectedIds, model);
  checkSolved();
}

async function doScramble() {
  if (animator.isAnimating || gamePaused) return;

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
}

async function doSolve() {
  if (animator.isAnimating || gamePaused || moveHistory.length === 0) return;
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
}

function doReset() {
  model.reset();
  const newDefs = getAllCubieDefs();
  renderer.rebuildCubies(newDefs, createAllCubies);
  moveCount = 0;
  moveHistory = [];
  updateMoveDisplay();
  resetTimer();
  gamePaused = false;
}

function generateScramble(count = 20) {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const opposites = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  const moves = [];
  let last = null;
  let secondLast = null;

  for (let i = 0; i < count; i++) {
    let face;
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
    } while (
      face === last ||
      (last && face === opposites[last] &&
        secondLast && FACE_CONFIG[face].axis === FACE_CONFIG[secondLast].axis)
    );

    const mod = Math.floor(Math.random() * 3);
    if (mod === 2) { moves.push({ face, direction: 'cw' }); moves.push({ face, direction: 'cw' }); }
    else if (mod === 1) { moves.push({ face, direction: 'ccw' }); }
    else { moves.push({ face, direction: 'cw' }); }

    secondLast = last;
    last = face;
  }
  return moves;
}

function getFaceFromIntersect(intersect) {
  if (!intersect || !intersect.face) return null;

  const normal = intersect.face.normal.clone();
  normal.transformDirection(intersect.object.matrixWorld);

  const abs = {
    x: Math.abs(normal.x),
    y: Math.abs(normal.y),
    z: Math.abs(normal.z),
  };

  if (abs.x > abs.y && abs.x > abs.z) return normal.x > 0 ? 'R' : 'L';
  if (abs.y > abs.x && abs.y > abs.z) return normal.y > 0 ? 'U' : 'D';
  if (abs.z > abs.x && abs.z > abs.y) return normal.z > 0 ? 'F' : 'B';
  return null;
}

function getIntersectedFace(e) {
  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, renderer.camera);

  const meshes = [];
  for (const g of renderer.cubieGroups) {
    if (g.children.length > 0) meshes.push(g.children[0]);
  }
  const intersects = raycaster.intersectObjects(meshes, false);
  if (intersects.length === 0) return null;
  return getFaceFromIntersect(intersects[0]);
}

canvas.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerStartTime = Date.now();
  pointerMoved = false;
  isDragging = true;
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

  if (pointerMoved) {
    touchTargetFace = null;
    return;
  }

  const face = touchTargetFace || getIntersectedFace(e);
  if (!face) return;

  const elapsed = Date.now() - pointerStartTime;
  const isLongPress = elapsed > LONG_PRESS_MS || e.shiftKey;
  const direction = isLongPress ? 'ccw' : 'cw';

  doMove(face, direction);
  touchTargetFace = null;
});

canvas.addEventListener('pointerleave', () => {
  isDragging = false;
  touchTargetFace = null;
});

document.addEventListener('keydown', (e) => {
  if (animator.isAnimating) return;
  const key = e.key.toUpperCase();

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

  if (key === 'P') {
    e.preventDefault();
    if (!gamePaused && (moveCount > 0 || timerRunning)) {
      pauseGame();
    }
    return;
  }

  if (gamePaused) return;

  const faceMap = { 'U': 'U', 'D': 'D', 'L': 'L', 'R': 'R', 'F': 'F', 'B': 'B' };
  const face = faceMap[key];
  if (face) {
    e.preventDefault();
    doMove(face, e.shiftKey ? 'ccw' : 'cw');
    return;
  }
  if (key === ' ') {
    e.preventDefault();
    doScramble();
  }
  if (key === 'S' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    doSolve();
  }
});

document.getElementById('btn-scramble').addEventListener('click', () => doScramble());
document.getElementById('btn-solve').addEventListener('click', () => doSolve());
document.getElementById('btn-reset').addEventListener('click', () => doReset());

document.getElementById('btn-theme').addEventListener('click', () => {
  theme.toggle();
});

btnSound.addEventListener('click', () => {
  const enabled = audio.toggle();
  btnSound.textContent = enabled ? '🔊' : '🔇';
  storage.set('soundEnabled', enabled);
});

document.getElementById('btn-pause').addEventListener('click', () => {
  if (!gamePaused) { pauseGame(); }
});

updateMoveDisplay();
updateTimerDisplay();
