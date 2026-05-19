/** localStorage 键名前缀，避免与其他站点数据冲突 */
const PREFIX = 'rubik_cube_';

/** 默认配置值，新用户首次访问时使用 */
const DEFAULTS = {
  theme: 'dark',
  soundEnabled: true,
  bestTime: null,    // 最快通关秒数
  bestMoves: null,   // 最少通关步数
  history: [],       // 历史成绩 [{time, moves, date}]
};

/**
 * 本地持久化存储
 * 将所有设置和成绩序列化为单个 JSON 对象存入 localStorage
 * 带 try/catch 保护（处理无痕浏览、配额溢出等情况）
 */
export class Storage {
  constructor() {
    this.cache = { ...DEFAULTS };
    this._load();
  }

  /** 从 localStorage 读取并合并到缓存 */
  _load() {
    try {
      const raw = localStorage.getItem(PREFIX + 'settings');
      if (raw) {
        Object.assign(this.cache, JSON.parse(raw));
      }
    } catch (e) { /* localStorage 不可用，使用默认值 */ }
  }

  /** 将缓存写入 localStorage */
  _save() {
    try {
      localStorage.setItem(PREFIX + 'settings', JSON.stringify(this.cache));
    } catch (e) { /* 配额溢出或不可用，静默失败 */ }
  }

  /** 读取某个设置值，不存在则返回默认值 */
  get(key) {
    return key in this.cache ? this.cache[key] : DEFAULTS[key];
  }

  /** 写入某个设置值并持久化 */
  set(key, value) {
    this.cache[key] = value;
    this._save();
  }

  /**
   * 记录一次通关成绩
   * 自动更新最佳用时和最少步数，并将本次成绩追加到历史
   */
  recordScore(time, moves) {
    const bestTime = this.get('bestTime');
    const bestMoves = this.get('bestMoves');
    if (bestTime === null || time < bestTime) this.set('bestTime', time);
    if (bestMoves === null || moves < bestMoves) this.set('bestMoves', moves);

    const history = this.get('history');
    history.push({ time, moves, date: Date.now() });
    // 限制历史记录上限 100 条
    if (history.length > 100) history.shift();
    this.set('history', history);
  }

  /** 获取最佳成绩 */
  getBest() {
    return {
      time: this.get('bestTime'),
      moves: this.get('bestMoves'),
    };
  }

  /** 清空历史记录 */
  clearHistory() {
    this.set('history', []);
  }
}
