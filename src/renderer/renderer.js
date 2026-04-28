let currentState = null;
let currentSummary = null;
let toastTimer = null;

const elements = {
  tabs: document.querySelectorAll('.tab'),
  panels: {
    streamers: document.getElementById('streamersPanel'),
    settings: document.getElementById('settingsPanel')
  },
  pollerState: document.getElementById('pollerState'),
  lastCheck: document.getElementById('lastCheck'),
  storagePath: document.getElementById('storagePath'),
  addStreamerForm: document.getElementById('addStreamerForm'),
  streamerInput: document.getElementById('streamerInput'),
  importText: document.getElementById('importText'),
  importButton: document.getElementById('importButton'),
  clearImportButton: document.getElementById('clearImportButton'),
  checkNowButton: document.getElementById('checkNowButton'),
  streamerRows: document.getElementById('streamerRows'),
  emptyState: document.getElementById('emptyState'),
  settingsForm: document.getElementById('settingsForm'),
  saveSettingsButton: document.getElementById('saveSettingsButton'),
  testEmailButton: document.getElementById('testEmailButton'),
  toast: document.getElementById('toast'),
  pollMinutes: document.getElementById('pollMinutes'),
  launchAtLogin: document.getElementById('launchAtLogin'),
  smtpPreset: document.getElementById('smtpPreset'),
  smtpHost: document.getElementById('smtpHost'),
  smtpPort: document.getElementById('smtpPort'),
  smtpSecure: document.getElementById('smtpSecure'),
  smtpUser: document.getElementById('smtpUser'),
  smtpPass: document.getElementById('smtpPass'),
  smtpFrom: document.getElementById('smtpFrom'),
  smtpTo: document.getElementById('smtpTo')
};

init();

async function init() {
  bindEvents();
  window.kickAlerts.onStateChanged(renderPayload);

  try {
    renderPayload(await window.kickAlerts.getState());
  } catch (error) {
    showToast(error.message || 'Unable to load app state.');
  }
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.tabs.forEach((item) => item.classList.remove('active'));
      Object.values(elements.panels).forEach((panel) => panel.classList.remove('active'));
      tab.classList.add('active');
      elements.panels[tab.dataset.tab].classList.add('active');
    });
  });

  elements.addStreamerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await window.kickAlerts.addStreamer(elements.streamerInput.value);
      elements.streamerInput.value = '';
      showToast('Streamer added.');
    });
  });

  elements.importButton.addEventListener('click', async () => {
    await runAction(async () => {
      const result = await window.kickAlerts.importStreamers(elements.importText.value);
      showToast(`Imported ${result.added} new streamer${result.added === 1 ? '' : 's'}.`);
    });
  });

  elements.clearImportButton.addEventListener('click', () => {
    elements.importText.value = '';
  });

  elements.checkNowButton.addEventListener('click', async () => {
    await runAction(async () => {
      const summary = await window.kickAlerts.pollNow();
      showToast(`Checked ${summary.checked} streamer${summary.checked === 1 ? '' : 's'}.`);
    });
  });

  elements.saveSettingsButton.addEventListener('click', async () => {
    await runAction(async () => {
      await window.kickAlerts.updateSettings(readSettingsForm());
      showToast('Settings saved.');
    });
  });

  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  elements.smtpPreset.addEventListener('change', () => {
    applySmtpPreset(elements.smtpPreset.value);
  });

  elements.testEmailButton.addEventListener('click', async () => {
    await runAction(async () => {
      await window.kickAlerts.updateSettings(readSettingsForm());
      await window.kickAlerts.testEmail();
      showToast('Test email sent.');
    });
  });

  elements.storagePath.addEventListener('click', () => {
    if (currentState && currentState.storagePath) {
      navigator.clipboard.writeText(currentState.storagePath);
      showToast('Storage path copied.');
    }
  });
}

function renderPayload(payload) {
  currentState = payload.state;
  currentSummary = payload.summary;
  renderSidebar(payload);
  renderSettings(currentState.settings);
  renderStreamers(currentState.streamers);
}

function renderSidebar(payload) {
  elements.pollerState.textContent = payload.isPolling ? 'Checking' : 'Idle';
  elements.lastCheck.textContent = payload.summary && payload.summary.at
    ? formatDateTime(payload.summary.at)
    : 'Never';
}

function renderSettings(settings) {
  const activeTag = document.activeElement ? document.activeElement.tagName : '';
  if (document.activeElement && elements.settingsForm.contains(document.activeElement) && ['INPUT', 'TEXTAREA'].includes(activeTag)) {
    return;
  }

  const smtp = settings.smtp || {};
  elements.pollMinutes.value = settings.pollMinutes || 5;
  elements.launchAtLogin.checked = Boolean(settings.launchAtLogin);
  elements.smtpPreset.value = detectSmtpPreset(smtp);
  elements.smtpHost.value = smtp.host || '';
  elements.smtpPort.value = smtp.port || 587;
  elements.smtpSecure.checked = Boolean(smtp.secure);
  elements.smtpUser.value = smtp.user || '';
  elements.smtpPass.value = smtp.pass || '';
  elements.smtpFrom.value = smtp.from || '';
  elements.smtpTo.value = smtp.to || '';
}

function renderStreamers(streamers) {
  elements.streamerRows.innerHTML = '';
  elements.emptyState.classList.toggle('visible', streamers.length === 0);

  streamers.forEach((streamer) => {
    const row = document.createElement('tr');
    const status = statusBadge(streamer);
    row.innerHTML = `
      <td>
        <div class="streamer-cell">
          <div class="streamer-name">${escapeHtml(streamer.displayName || streamer.slug)}</div>
          <div class="streamer-title">${escapeHtml(streamer.title || streamer.url || '')}</div>
        </div>
      </td>
      <td>${status}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${streamer.emailEnabled ? 'checked' : ''} data-action="toggle-email">
          <span>${streamer.emailEnabled ? 'On' : 'Off'}</span>
        </label>
      </td>
      <td>${streamer.lastCheckedAt ? formatDateTime(streamer.lastCheckedAt) : 'Never'}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="secondary" data-action="open">Open</button>
          <button type="button" class="danger" data-action="remove">Remove</button>
        </div>
      </td>
    `;

    row.querySelector('[data-action="toggle-email"]').addEventListener('change', async (event) => {
      await runAction(async () => {
        await window.kickAlerts.updateStreamer(streamer.id, { emailEnabled: event.target.checked });
      });
    });

    row.querySelector('[data-action="open"]').addEventListener('click', () => {
      window.kickAlerts.openExternal(streamer.url || `https://kick.com/${streamer.slug}`);
    });

    row.querySelector('[data-action="remove"]').addEventListener('click', async () => {
      await runAction(async () => {
        await window.kickAlerts.removeStreamer(streamer.id);
        showToast('Streamer removed.');
      });
    });

    elements.streamerRows.appendChild(row);
  });
}

function statusBadge(streamer) {
  if (streamer.lastError) {
    return `<span class="badge error" title="${escapeHtml(streamer.lastError)}">Error</span>`;
  }

  if (streamer.isLive) {
    return '<span class="badge live">Live</span>';
  }

  return '<span class="badge offline">Offline</span>';
}

function readSettingsForm() {
  return {
    pollMinutes: Number(elements.pollMinutes.value || 5),
    launchAtLogin: elements.launchAtLogin.checked,
    smtp: {
      host: elements.smtpHost.value.trim(),
      port: Number(elements.smtpPort.value || 587),
      secure: elements.smtpSecure.checked,
      user: elements.smtpUser.value.trim(),
      pass: elements.smtpPass.value,
      from: elements.smtpFrom.value.trim(),
      to: elements.smtpTo.value.trim()
    }
  };
}

function applySmtpPreset(preset) {
  const presets = {
    gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
    outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    yahoo: { host: 'smtp.mail.yahoo.com', port: 465, secure: true }
  };

  const selected = presets[preset];
  if (!selected) {
    return;
  }

  elements.smtpHost.value = selected.host;
  elements.smtpPort.value = selected.port;
  elements.smtpSecure.checked = selected.secure;
}

function detectSmtpPreset(smtp) {
  const host = String(smtp.host || '').toLowerCase();
  const port = Number(smtp.port || 587);
  const secure = Boolean(smtp.secure);

  if (host === 'smtp.gmail.com' && port === 587 && !secure) {
    return 'gmail';
  }

  if (host === 'smtp-mail.outlook.com' && port === 587 && !secure) {
    return 'outlook';
  }

  if (host === 'smtp.mail.yahoo.com' && port === 465 && secure) {
    return 'yahoo';
  }

  return 'custom';
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    showToast(error.message || 'Something went wrong.');
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, 3400);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
