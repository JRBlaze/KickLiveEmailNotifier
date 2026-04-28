const path = require('path');
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
const { Store } = require('./store');
const { getChannelStatus } = require('./kick');
const { canSendEmail, sendLiveEmail, testEmail } = require('./mailer');

let mainWindow;
let tray;
let store;
let pollTimer;
let isPolling = false;
let lastPollSummary = {
  checked: 0,
  alerted: 0,
  errors: 0,
  at: null
};
const appIconPath = getAppIconPath();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  showWindow();
});

app.on('activate', () => {
  showWindow();
});

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  store.load();

  createWindow();
  createTray();
  syncDockVisibility();
  applyLaunchAtLogin();
  schedulePolling();
  pollNow('startup');
});

app.on('window-all-closed', () => {
  // Keep the tray process alive after the main window is closed.
});

app.on('before-quit', () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Kick Live Email Alerts',
    icon: appIconPath,
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    showWindow();
  });

  mainWindow.on('close', (event) => {
    const settings = store ? store.getSettings() : {};
    if (!app.isQuitting && settings.closeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
      syncDockVisibility();
    }
  });

  mainWindow.on('minimize', (event) => {
    const settings = store ? store.getSettings() : {};
    if (settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
      syncDockVisibility();
    }
  });

  mainWindow.on('show', syncDockVisibility);
  mainWindow.on('hide', syncDockVisibility);
}

function createTray() {
  const icon = nativeImage.createFromPath(appIconPath);

  tray = new Tray(icon);
  tray.setToolTip('Kick Live Email Alerts');
  updateTrayMenu();
  tray.on('click', showWindow);
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const liveCount = store ? store.getStreamers().filter((streamer) => streamer.isLive).length : 0;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Kick Live Email Alerts', click: showWindow },
    { label: `${liveCount} streamer${liveCount === 1 ? '' : 's'} live`, enabled: false },
    { label: 'Check now', click: () => pollNow('tray') },
    { type: 'separator' },
    {
      label: 'Minimize to tray',
      type: 'checkbox',
      checked: Boolean(store && store.getSettings().minimizeToTray),
      click: (item) => updateTrayBehavior({ minimizeToTray: item.checked })
    },
    {
      label: 'Close to tray',
      type: 'checkbox',
      checked: Boolean(store && store.getSettings().closeToTray !== false),
      click: (item) => updateTrayBehavior({ closeToTray: item.checked })
    },
    ...(process.platform === 'darwin' ? [
      {
        label: 'Show Dock icon while in tray',
        type: 'checkbox',
        checked: Boolean(store && store.getSettings().showDockIconWhenHidden),
        click: (item) => updateTrayBehavior({ showDockIconWhenHidden: item.checked })
      },
      { type: 'separator' }
    ] : []),
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function showWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.show();
  syncDockVisibility();
  mainWindow.focus();
}

function hideDockIcon() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

function showDockIcon() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
}

function syncDockVisibility() {
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }

  const settings = store ? store.getSettings() : {};
  if (!mainWindow || !mainWindow.isVisible()) {
    if (settings.showDockIconWhenHidden) {
      showDockIcon();
    } else {
      hideDockIcon();
    }
    return;
  }

  showDockIcon();
}

function updateTrayBehavior(patch) {
  if (!store) {
    return;
  }

  store.updateSettings(patch || {});
  updateTrayMenu();
  syncDockVisibility();
  sendState();
}

function sendState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:changed', {
      state: store.snapshot(),
      summary: lastPollSummary,
      isPolling
    });
  }

  updateTrayMenu();
}

function schedulePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  const minutes = Math.max(1, Number(store.getSettings().pollMinutes || 5));
  pollTimer = setInterval(() => pollNow('timer'), minutes * 60 * 1000);
}

async function pollNow(reason = 'manual') {
  if (isPolling || !store) {
    return lastPollSummary;
  }

  isPolling = true;
  sendState();

  const streamers = [...store.getStreamers()];
  let checked = 0;
  let alerted = 0;
  let errors = 0;

  for (const streamer of streamers) {
    try {
      const previousLiveKey = streamer.lastLiveKey;
      const previousLive = Boolean(streamer.isLive);
      const status = await getChannelStatus(streamer.slug);
      checked += 1;

      const updated = {
        displayName: status.displayName || streamer.displayName,
        isLive: status.isLive,
        lastLiveKey: status.liveKey,
        lastError: null,
        title: status.title || '',
        category: status.category || '',
        viewers: status.viewers,
        startedAt: status.startedAt,
        url: status.url,
        thumbnail: status.thumbnail || ''
      };

      store.setStreamerStatus(streamer.id, updated);

      const wentLive = status.isLive && (!previousLive || previousLiveKey !== status.liveKey);
      if (wentLive && streamer.emailEnabled && canSendEmail(store.getSettings())) {
        const emailStreamer = {
          ...streamer,
          ...updated,
          slug: streamer.slug
        };
        await sendLiveEmail(store.getSettings(), emailStreamer);
        store.save();
        store.updateStreamer(streamer.id, { lastNotifiedAt: new Date().toISOString() });
        alerted += 1;
      }
    } catch (error) {
      errors += 1;
      store.setStreamerStatus(streamer.id, {
        lastError: error.message || 'Unable to check streamer.'
      });
    }
  }

  lastPollSummary = {
    checked,
    alerted,
    errors,
    reason,
    at: new Date().toISOString()
  };

  isPolling = false;
  sendState();
  return lastPollSummary;
}

function applyLaunchAtLogin() {
  const enabled = Boolean(store.getSettings().launchAtLogin);
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  });
}

ipcMain.handle('state:get', () => ({
  state: store.snapshot(),
  summary: lastPollSummary,
  isPolling
}));

ipcMain.handle('settings:update', async (_event, settings) => {
  store.updateSettings(settings || {});
  applyLaunchAtLogin();
  schedulePolling();
  syncDockVisibility();
  sendState();
  return store.snapshot();
});

ipcMain.handle('streamer:add', async (_event, input) => {
  const streamer = store.addStreamer(input);
  sendState();
  setTimeout(() => pollNow('streamer-added'), 250);
  return streamer;
});

ipcMain.handle('streamer:import', async (_event, text) => {
  const result = store.importStreamers(text);
  sendState();
  setTimeout(() => pollNow('streamers-imported'), 250);
  return result;
});

ipcMain.handle('streamer:update', async (_event, id, patch) => {
  const streamer = store.updateStreamer(id, patch || {});
  sendState();
  return streamer;
});

ipcMain.handle('streamer:remove', async (_event, id) => {
  const state = store.removeStreamer(id);
  sendState();
  return state;
});

ipcMain.handle('poll:now', async () => pollNow('manual'));

ipcMain.handle('email:test', async () => {
  await testEmail(store.getSettings());
  store.save();
  return { ok: true };
});

ipcMain.handle('external:open', async (_event, url) => {
  if (typeof url === 'string' && /^https:\/\/kick\.com\//i.test(url)) {
    await shell.openExternal(url);
  }
});

function getAppIconPath() {
  const iconFile = process.platform === 'win32' ? 'Icon.ico' : 'Icon.png';

  return path.join(__dirname, '..', 'assets', iconFile);
}
