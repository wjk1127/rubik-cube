import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Three.js 渲染管理器
 * 负责场景搭建、灯光、相机、OrbitControls 以及渲染循环
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.cubieGroups = [];   // 全部方块 Group 的引用列表
    this.cubieMap = new Map(); // cubieId → Group 快速查找

    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._setupControls();
    this._setupResize();

    // 使用 setAnimationLoop 自动处理标签页隐藏时的暂停
    this.renderer.setAnimationLoop(() => this._render());
  }

  /** WebGL 渲染器配置 */
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  /** 场景 & 立方体根节点 */
  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x1a1a2e, 6, 20);

    // 所有方块都挂在此节点下，方便整体操作
    this.cubeRoot = new THREE.Group();
    this.scene.add(this.cubeRoot);

    // 地面环形网格（装饰）
    const gridHelper = new THREE.PolarGridHelper(3, 32, 16, 64, 0x333355, 0x333355);
    gridHelper.position.y = -2.5;
    this.scene.add(gridHelper);
  }

  /** 透视相机：45° FOV，远离立方体以便观察 */
  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.5, 50
    );
    this.camera.position.set(4.5, 3.2, 5.5);
    this.camera.lookAt(0, 0, 0);
  }

  /** 三点布光：环境光 + 主光(带阴影) + 补光 + 轮廓光 */
  _setupLights() {
    const ambient = new THREE.AmbientLight(0x8899cc, 2.5);
    this.scene.add(ambient);

    // 主光源（投射阴影）
    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.position.set(6, 10, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 50;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0001;
    this.scene.add(key);

    // 补光（减少暗面过黑）
    const fill = new THREE.DirectionalLight(0x6688cc, 1.5);
    fill.position.set(-3, 1, -2);
    this.scene.add(fill);

    // 轮廓光（从下方打亮边缘）
    const rim = new THREE.DirectionalLight(0xaaccff, 2);
    rim.position.set(0, -1, 4);
    this.scene.add(rim);
  }

  /** 轨道控制器：拖拽旋转视角，滚轮缩放 */
  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 10;
    this.controls.target.set(0, 0, 0);
    this.controls.enablePan = false;   // 禁用平移，保持魔方居中
    this.controls.rotateSpeed = 0.6;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI - 0.2;
  }

  /** 窗口缩放响应 */
  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** 每帧渲染 */
  _render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 替换场景中的全部方块
   * @param {THREE.Group[]} groups - 新的方块 Group 数组
   */
  setCubies(groups) {
    this.cubeRoot.clear();
    this.cubieGroups = groups;
    this.cubieMap.clear();
    for (const g of groups) {
      this.cubeRoot.add(g);
      this.cubieMap.set(g.userData.cubieId, g);
    }
  }

  /** 根据 cubieId 获取方块 Group */
  getCubieGroup(id) {
    return this.cubieMap.get(id);
  }

  /**
   * 销毁旧方块并重建（用于重置魔方）
   * @param {Object[]} defs - 方块定义数组
   * @param {Function} factoryFn - 方块创建工厂函数
   */
  rebuildCubies(defs, factoryFn) {
    this.setCubies(factoryFn(defs));
  }

  /** 重置相机到默认视角 */
  resetCamera() {
    this.camera.position.set(4.5, 3.2, 5.5);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
