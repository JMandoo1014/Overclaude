'use strict';

const { app, Tray, Menu, nativeImage } = require('electron');

const store = require('./src/store');
const overlay = require('./src/overlay');
const icon = require('./src/icon');
const { collectLoginCookies } = require('./src/login');
const { fetchOrganizations, fetchUsage, ApiError } = require('./src/api');

const POLL_INTERVAL_MS = 60 * 1000;

let tray = null;
let pollTimer = null;
let cookieHeader = null;
let orgUuid = null;
let latestUsage = null; // { fiveHour, sevenDay }
let isRefreshing = false;
let panelPosition = 'top-right';

// status: 'loading' | 'ok' | 'error' | 'auth_required'
const state = { status: 'loading', errorMessage: null };

function toIconImage(buffer) {
  // The buffer is rendered at 2x (44x44) for a 22pt menu bar icon — tag it
  // as such so macOS treats it as a crisp retina representation, not a
  // literal 44pt icon.
  const image = nativeImage.createFromBuffer(buffer, { scaleFactor: 2 });
  image.setTemplateImage(false); // full-color gauge, not a template image
  return image;
}

function formatPercent(utilization) {
  if (utilization === null || utilization === undefined || Number.isNaN(utilization)) {
    return null;
  }
  // Usage APIs of this shape sometimes report a 0..1 fraction and
  // sometimes a 0..100 percentage — normalize defensively.
  const pct = utilization <= 1 ? utilization * 100 : utilization;
  return Math.round(pct);
}

function tooltipForState() {
  if (state.status === 'auth_required') return 'Overclaude — 로그인이 필요합니다';
  if (state.status === 'error') return `Overclaude — 오류: ${state.errorMessage || '알 수 없는 오류'}`;
  if (state.status === 'loading') return 'Overclaude — 불러오는 중...';
  if (latestUsage) {
    const fivePct = formatPercent(latestUsage.fiveHour.utilization);
    const sevenPct = formatPercent(latestUsage.sevenDay.utilization);
    return `Overclaude — 5시간 ${fivePct ?? '--'}% · 주간 ${sevenPct ?? '--'}%`;
  }
  return 'Overclaude — Claude usage monitor';
}

async function updateTrayIcon() {
  if (!tray) return;

  let buffer;
  if (state.status === 'auth_required' || state.status === 'error') {
    buffer = await icon.renderErrorIcon();
  } else if (state.status === 'loading') {
    buffer = await icon.renderLoadingIcon();
  } else {
    const fivePct = formatPercent(latestUsage?.fiveHour?.utilization) ?? 0;
    buffer = await icon.renderGaugeIcon(fivePct);
  }

  tray.setImage(toIconImage(buffer));
  tray.setToolTip(tooltipForState());
}

function buildOverlayPayload() {
  if (state.status === 'loading') return { status: 'loading', refreshing: isRefreshing };
  if (state.status === 'auth_required') return { status: 'auth_required', refreshing: isRefreshing };
  if (state.status === 'error') {
    return { status: 'error', message: state.errorMessage, refreshing: isRefreshing };
  }

  return {
    status: 'ok',
    refreshing: isRefreshing,
    fiveHour: {
      percent: formatPercent(latestUsage?.fiveHour?.utilization),
      resetsAt: latestUsage?.fiveHour?.resetsAt ?? null,
    },
    sevenDay: {
      percent: formatPercent(latestUsage?.sevenDay?.utilization),
      resetsAt: latestUsage?.sevenDay?.resetsAt ?? null,
    },
  };
}

function pushOverlayUpdate() {
  if (overlay.isVisible()) {
    overlay.sendUsageUpdate(buildOverlayPayload());
  }
}

async function applyState() {
  await updateTrayIcon();
  pushOverlayUpdate();
}

function setPanelPosition(position) {
  panelPosition = position === 'top-left' ? 'top-left' : 'top-right';
  store.savePanelPosition(panelPosition);
  overlay.setPosition(panelPosition);
}

function buildMenu() {
  const template = [];

  if (!cookieHeader) {
    template.push({ label: '로그인...', click: () => triggerLogin() });
    template.push({ type: 'separator' });
    template.push({ label: '종료', role: 'quit' });
    return Menu.buildFromTemplate(template);
  }

  template.push({
    label: '지금 새로고침',
    click: () => refreshUsage(),
    enabled: !isRefreshing,
  });
  template.push({ label: '재로그인', click: () => triggerLogin() });
  template.push({ type: 'separator' });
  template.push({
    label: '패널 위치',
    submenu: [
      {
        label: '왼쪽 상단',
        type: 'radio',
        checked: panelPosition === 'top-left',
        click: () => setPanelPosition('top-left'),
      },
      {
        label: '오른쪽 상단',
        type: 'radio',
        checked: panelPosition === 'top-right',
        click: () => setPanelPosition('top-right'),
      },
    ],
  });
  template.push({ type: 'separator' });
  template.push({ label: '종료', role: 'quit' });

  return Menu.buildFromTemplate(template);
}

async function ensureOrganization() {
  const cached = store.loadOrgUuid();
  if (cached) {
    orgUuid = cached;
    return;
  }
  const orgs = await fetchOrganizations(cookieHeader);
  orgUuid = orgs[0].uuid;
  store.saveOrgUuid(orgUuid);
}

async function refreshUsage() {
  if (!cookieHeader || isRefreshing) return;
  isRefreshing = true;
  pushOverlayUpdate(); // let the panel show its refresh spinner right away

  // Only show the loading glyph on the very first fetch (no data yet) —
  // subsequent polls keep the last-known gauge visible while refreshing.
  if (!latestUsage) {
    state.status = 'loading';
    await applyState();
  }

  try {
    if (!orgUuid) {
      await ensureOrganization();
    }
    const usage = await fetchUsage(cookieHeader, orgUuid);
    latestUsage = usage;
    state.status = 'ok';
    state.errorMessage = null;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'AUTH_EXPIRED') {
      await handleAuthExpired();
    } else {
      state.status = 'error';
      state.errorMessage = err.message || '알 수 없는 오류';
      console.error('[overclaude] refresh error:', err);
    }
  } finally {
    isRefreshing = false;
    await applyState();
  }
}

async function handleAuthExpired() {
  state.status = 'auth_required';
  state.errorMessage = null;
  cookieHeader = null;
  latestUsage = null;
  store.clearCookies();
  store.clearOrgUuid();
  orgUuid = null;
  await applyState();
  await triggerLogin();
}

async function triggerLogin() {
  try {
    const cookies = await collectLoginCookies();
    cookieHeader = cookies;
    store.saveCookies(cookies);
    orgUuid = null;
    store.clearOrgUuid();
    latestUsage = null;
    await refreshUsage();
  } catch (err) {
    state.status = cookieHeader ? state.status : 'auth_required';
    console.error('[overclaude] login error:', err);
    await applyState();
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    refreshUsage();
  }, POLL_INTERVAL_MS);
}

async function init() {
  app.dock.hide();

  overlay.onRefreshRequested(() => refreshUsage());

  tray = new Tray(toIconImage(await icon.renderLoadingIcon()));
  tray.setToolTip('Overclaude — Claude usage monitor');

  tray.on('click', () => {
    const visible = overlay.toggle(panelPosition);
    store.savePanelVisible(visible);
    if (visible) pushOverlayUpdate();
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(buildMenu());
  });

  panelPosition = store.loadPanelPosition();
  overlay.setPosition(panelPosition);

  cookieHeader = store.loadCookies();
  orgUuid = store.loadOrgUuid();

  if (store.loadPanelVisible()) {
    overlay.show(panelPosition);
  }

  if (!cookieHeader) {
    state.status = 'auth_required';
    await applyState();
    await triggerLogin();
  } else {
    await refreshUsage();
  }

  startPolling();
}

app.whenReady().then(() => {
  init().catch((err) => {
    console.error('[overclaude] init failed:', err);
  });
});

app.on('window-all-closed', (event) => {
  // Keep running in the menu bar even with no windows open.
  event.preventDefault();
});
