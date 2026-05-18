import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.cubieGroups = [];
    this.cubieMap = new Map();

    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._setupControls();
    this._setupResize();

    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    this._animate();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x1a1a2e, 6, 20);

    this.cubeRoot = new THREE.Group();
    this.scene.add(this.cubeRoot);

    const gridHelper = new THREE.PolarGridHelper(3, 32, 16, 64, 0x333355, 0x333355);
    gridHelper.position.y = -2.5;
    this.scene.add(gridHelper);
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 50);
    this.camera.position.set(4.5, 3.2, 5.5);
    this.camera.lookAt(0, 0, 0);
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x8899cc, 2.5);
    this.scene.add(ambient);

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

    const fill = new THREE.DirectionalLight(0x6688cc, 1.5);
    fill.position.set(-3, 1, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xaaccff, 2);
    rim.position.set(0, -1, 4);
    this.scene.add(rim);
  }

  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 10;
    this.controls.target.set(0, 0, 0);
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI - 0.2;
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setCubies(groups) {
    this.cubeRoot.clear();
    this.cubieGroups = groups;
    this.cubieMap.clear();
    for (const g of groups) {
      this.cubeRoot.add(g);
      this.cubieMap.set(g.userData.cubieId, g);
    }
  }

  getCubieGroup(id) {
    return this.cubieMap.get(id);
  }

  rebuildCubies(defs, factoryFn) {
    const newGroups = factoryFn(defs);
    this.setCubies(newGroups);
  }

  resetCamera() {
    this.camera.position.set(4.5, 3.2, 5.5);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
