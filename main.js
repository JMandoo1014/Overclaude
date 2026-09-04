'use strict';

const path = require('path');
const { app, Tray, Menu, nativeImage, shell } = require('electron');

const store = require('./src/store');
const { collectLoginCookies } = require('./src/login');
const { fetchOrganizations, fetchUsage, ApiError } = require('./src/api');

const POLL_INTERVAL_MS = 60 * 1000;

let tray = null;
let pollTimer = null;
let cookieHeader = null;
let orgUuid = null;
let orgName = null;
let latestUsage = null; // { fiveHour, sevenDay }
let lastError = null; // string | null
let isRefreshing = false;

function trayIconPath() {
  return path.join(__dirname, 'assets', 'trayTemplate.png');
}

function loadTrayIcon() {
  const image = nativeImage.createFromPath(trayIconPath());
  image.setTemplateImage(true);
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

function trafficLightForPercent(pct) {
  if (pct === null) return '⚪️';
  if (pct >= 80) return '🔴';
  if (pct >= 50) return '🟠';
  return '🟢';
}

function formatResetTime(isoString) {
  if (!isoString) return 'unknown';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function updateTrayTitleAndMenu() {
  if (!tray) return;

  if (lastError) {
    tray.setTitle('⚠️');
  } else if (latestUsage) {
    const fivePct = formatPercent(latestUsage.fiveHour.utilization);
    const dot = trafficLightForPercent(fivePct);
    tray.setTitle(fivePct === null ? `${dot} --%` : `${dot} ${fivePct}%`);
  } else {
    tray.setTitle('…');
  }

  tray.setContextMenu(buildMenu());
}

function buildMenu() {
  const template = [];

  if (!cookieHeader) {
    template.push({ label: '로그인이 필요합니다', enabled: false });
    template.push({ label: '로그인...', click: () => triggerLogin() });
    template.push({ type: 'separator' });
    template.push({ label: '종료', role: 'quit' });
    return Menu.buildFromTemplate(template);
  }

  if (lastError) {
    template.push({ label: `⚠️ ${lastError}`, enabled: false });
    template.push({ type: 'separator' });
  }

  if (latestUsage) {
    const fivePct = formatPercent(latestUsage.fiveHour.utilization);
    const sevenPct = formatPercent(latestUsage.sevenDay.utilization);

    template.push({
      label: `5시간 사용률: ${fivePct === null ? '알 수 없음' : `${fivePct}%`}`,
      enabled: false,
    });
    template.push({
      label: `  리셋: ${formatResetTime(latestUsage.fiveHour.resetsAt)}`,
      enabled: false,
    });
    template.push({ type: 'separator' });
    template.push({
      label: `주간 사용률: ${sevenPct === null ? '알 수 없음' : `${sevenPct}%`}`,
      enabled: false,
    });
    template.push({
      label: `  리셋: ${formatResetTime(latestUsage.sevenDay.resetsAt)}`,
      enabled: false,
    });
    template.push({ type: 'separator' });
  } else if (!lastError) {
    template.push({ label: '사용량 불러오는 중...', enabled: false });
    template.push({ type: 'separator' });
  }

  if (orgName) {
    template.push({ label: `조직: ${orgName}`, enabled: false });
    template.push({ type: 'separator' });
  }

  template.push({
    label: '지금 새로고침',
    click: () => refreshUsage(),
    enabled: !isRefreshing,
  });
  template.push({ label: '재로그인', click: () => triggerLogin() });
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
  orgName = orgs[0].name;
  store.saveOrgUuid(orgUuid);
}

async function refreshUsage() {
  if (!cookieHeader || isRefreshing) return;
  isRefreshing = true;
  updateTrayTitleAndMenu();

  try {
    if (!orgUuid) {
      await ensureOrganization();
    }
    const usage = await fetchUsage(cookieHeader, orgUuid);
    latestUsage = usage;
    lastError = null;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'AUTH_EXPIRED') {
      await handleAuthExpired();
    } else {
      lastError = err.message || '알 수 없는 오류';
      console.error('[overclaude] refresh error:', err);
    }
  } finally {
    isRefreshing = false;
    updateTrayTitleAndMenu();
  }
}

async function handleAuthExpired() {
  lastError = '세션이 만료되었습니다. 재로그인이 필요합니다.';
  cookieHeader = null;
  latestUsage = null;
  store.clearCookies();
  store.clearOrgUuid();
  orgUuid = null;
  orgName = null;
  updateTrayTitleAndMenu();
  await triggerLogin();
}

async function triggerLogin() {
  try {
    const cookies = await collectLoginCookies();
    cookieHeader = cookies;
    store.saveCookies(cookies);
    lastError = null;
    orgUuid = null;
    orgName = null;
    store.clearOrgUuid();
    await refreshUsage();
  } catch (err) {
    lastError = `로그인 실패: ${err.message}`;
    console.error('[overclaude] login error:', err);
    updateTrayTitleAndMenu();
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

  tray = new Tray(loadTrayIcon());
  tray.setToolTip('Overclaude — Claude usage monitor');
  updateTrayTitleAndMenu();

  cookieHeader = store.loadCookies();
  orgUuid = store.loadOrgUuid();

  if (!cookieHeader) {
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
