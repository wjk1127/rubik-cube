/**
 * 主题管理器
 *
 * 通过切换 <html data-theme="dark|light"> 属性来实现主题变更，
 * CSS 中定义对应的自定义属性变量。
 * 支持"自动"模式（跟随系统偏好），用户手动切换后则固定。
 */
export class ThemeManager {
  constructor(storage) {
    this.storage = storage;
    this._apply();       // 初始加载时应用存储的主题
    this._watchSystem(); // 监听系统主题变化
  }

  /** 根据存储设置或系统偏好应用主题 */
  _apply() {
    const saved = this.storage.get('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved === 'auto'
      ? (prefersDark ? 'dark' : 'light')
      : saved;
    document.documentElement.setAttribute('data-theme', theme);
    this._updateIcon(theme);
  }

  /**
   * 切换主题（深色 ↔ 浅色）
   * @returns {string} 切换后的主题名称
   */
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.storage.set('theme', next);
    this._updateIcon(next);
    return next;
  }

  /** 更新主题按钮图标 */
  _updateIcon(theme) {
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? '🌓' : '🌞';
    }
  }

  /** 监听操作系统主题切换（仅当用户设置为"自动"时生效） */
  _watchSystem() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.storage.get('theme') === 'auto') this._apply();
    });
  }
}
