export class ThemeManager {
  constructor(storage) {
    this.storage = storage;
    this._apply();
    this._watchSystem();
  }

  _apply() {
    const saved = this.storage.get('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved === 'auto' ? (prefersDark ? 'dark' : 'light') : saved;
    document.documentElement.setAttribute('data-theme', theme);
    this._updateIcon(theme);
  }

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.storage.set('theme', next);
    this._updateIcon(next);
    return next;
  }

  _updateIcon(theme) {
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? '🌓' : '🌞';
    }
  }

  _watchSystem() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.storage.get('theme') === 'auto') {
        this._apply();
      }
    });
  }
}
