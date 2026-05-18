const PREFIX = 'rubik_cube_';

const DEFAULTS = {
  theme: 'dark',
  soundEnabled: true,
  bestTime: null,
  bestMoves: null,
  history: [],
};

export class Storage {
  constructor() {
    this.cache = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(PREFIX + 'settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(this.cache, parsed);
      }
    } catch (e) {
      // localStorage unavailable, use defaults
    }
  }

  _save() {
    try {
      localStorage.setItem(PREFIX + 'settings', JSON.stringify(this.cache));
    } catch (e) {
      // quota exceeded or unavailable
    }
  }

  get(key) {
    return key in this.cache ? this.cache[key] : DEFAULTS[key];
  }

  set(key, value) {
    this.cache[key] = value;
    this._save();
  }

  recordScore(time, moves) {
    const bestTime = this.get('bestTime');
    const bestMoves = this.get('bestMoves');
    if (bestTime === null || time < bestTime) {
      this.set('bestTime', time);
    }
    if (bestMoves === null || moves < bestMoves) {
      this.set('bestMoves', moves);
    }
    const history = this.get('history');
    history.push({ time, moves, date: Date.now() });
    if (history.length > 100) {
      history.shift();
    }
    this.set('history', history);
  }

  getBest() {
    return {
      time: this.get('bestTime'),
      moves: this.get('bestMoves'),
    };
  }

  clearHistory() {
    this.set('history', []);
  }
}
