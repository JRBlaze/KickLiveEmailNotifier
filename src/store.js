const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_STATE = {
  settings: {
    pollMinutes: 5,
    launchAtLogin: false,
    closeToTray: true,
    minimizeToTray: true,
    showDockIconWhenHidden: true,
    smtp: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
      to: ''
    }
  },
  streamers: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?kick\.com\//i, '')
    .split(/[/?#]/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

class Store {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'kick-live-email-alerts.json');
    this.state = clone(DEFAULT_STATE);
  }

  load() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.save();
      return this.snapshot();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state = {
        ...clone(DEFAULT_STATE),
        ...parsed,
        settings: {
          ...clone(DEFAULT_STATE.settings),
          ...(parsed.settings || {}),
          smtp: {
            ...clone(DEFAULT_STATE.settings.smtp),
            ...((parsed.settings && parsed.settings.smtp) || {})
          }
        },
        streamers: Array.isArray(parsed.streamers) ? parsed.streamers : []
      };
    } catch {
      const backupPath = `${this.filePath}.broken-${Date.now()}`;
      fs.copyFileSync(this.filePath, backupPath);
      this.state = clone(DEFAULT_STATE);
      this.save();
    }

    return this.snapshot();
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  snapshot() {
    return clone({
      ...this.state,
      storagePath: this.filePath
    });
  }

  updateSettings(settings) {
    this.state.settings = {
      ...this.state.settings,
      ...settings,
      smtp: {
        ...this.state.settings.smtp,
        ...(settings.smtp || {})
      },
      pollMinutes: Math.max(1, Number(settings.pollMinutes || this.state.settings.pollMinutes || 5))
    };
    this.save();
    return this.snapshot();
  }

  addStreamer(input) {
    const slug = normalizeSlug(input);
    if (!slug) {
      throw new Error('Enter a valid Kick username.');
    }

    const existing = this.state.streamers.find((streamer) => streamer.slug === slug);
    if (existing) {
      return existing;
    }

    const streamer = {
      id: crypto.randomUUID(),
      slug,
      displayName: slug,
      emailEnabled: true,
      isLive: false,
      lastLiveKey: null,
      lastCheckedAt: null,
      lastNotifiedAt: null,
      lastError: null,
      title: '',
      category: '',
      viewers: null,
      startedAt: null,
      url: `https://kick.com/${slug}`,
      thumbnail: ''
    };

    this.state.streamers.push(streamer);
    this.state.streamers.sort((a, b) => a.slug.localeCompare(b.slug));
    this.save();
    return streamer;
  }

  importStreamers(text) {
    const values = String(text || '')
      .split(/[\r\n,;]+/)
      .map(normalizeSlug)
      .filter(Boolean);

    const unique = [...new Set(values)];
    const before = this.state.streamers.length;
    unique.forEach((slug) => this.addStreamer(slug));
    return {
      added: this.state.streamers.length - before,
      total: this.state.streamers.length
    };
  }

  removeStreamer(id) {
    this.state.streamers = this.state.streamers.filter((streamer) => streamer.id !== id);
    this.save();
    return this.snapshot();
  }

  updateStreamer(id, patch) {
    const streamer = this.state.streamers.find((item) => item.id === id);
    if (!streamer) {
      throw new Error('Streamer not found.');
    }

    Object.assign(streamer, patch);
    this.save();
    return streamer;
  }

  setStreamerStatus(id, status) {
    const streamer = this.state.streamers.find((item) => item.id === id);
    if (!streamer) {
      return null;
    }

    Object.assign(streamer, status, { lastCheckedAt: new Date().toISOString() });
    this.save();
    return streamer;
  }

  getStreamers() {
    return this.state.streamers;
  }

  getSettings() {
    return this.state.settings;
  }
}

module.exports = {
  Store,
  normalizeSlug
};
