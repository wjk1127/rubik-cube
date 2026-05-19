/**
 * 音效管理器（基于 Web Audio API 程序化生成音效）
 *
 * 设计要点：
 * - 延迟初始化 AudioContext（浏览器要求必须在用户交互后创建）
 * - AudioContext 被暂停时自动恢复（某些浏览器在标签页后台时会暂停）
 * - 每次播放创建短生命周期 OscillatorNode，用完即弃
 */
export class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    // 首次用户交互时初始化 AudioContext
    const init = () => {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.enabled = false; }
    };
    document.addEventListener('pointerdown', init, { once: true });
    document.addEventListener('keydown', init, { once: true });
  }

  /** 确保 AudioContext 可用（不存在则创建，暂停则恢复） */
  _ensureContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.enabled = false; return false; }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  /**
   * 旋转音效：短促的下降音（600Hz→300Hz，60ms）
   * 模拟机械转动的声音
   */
  playMove() {
    if (!this.enabled || !this._ensureContext()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * 打乱音效：5 声快速上升的方波（200Hz→600Hz，每声 40ms，间隔 40ms）
   */
  playScramble() {
    if (!this.enabled || !this._ensureContext()) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!this._ensureContext()) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(200 + i * 100, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.04);
      }, i * 40);
    }
  }

  /**
   * 通关音效：C-E-G-C 上行琶音（C5=523Hz, E5=659Hz, G5=784Hz, C6=1047Hz）
   * 每音持续 400ms，间隔 120ms
   */
  playSolve() {
    if (!this.enabled || !this._ensureContext()) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this._ensureContext()) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.4);
      }, i * 120);
    });
  }

  /** 切换音效开关，返回当前状态 */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
