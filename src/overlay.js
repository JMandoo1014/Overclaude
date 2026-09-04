'use strict';

const path = require('path');
const { BrowserWindow, screen, ipcMain } = require('electron');

const WIDTH = 240;
const HEIGHT = 150;
const EDGE_MARGIN = 8; // gap from the screen edge / menu bar

let win = null;
let currentPosition = 'top-right';
let refreshHandler = null;

ipcMain.on('overlay:refresh-request', () => {
  if (refreshHandler) refreshHandler();
});

/** Registers the callback invoked when the panel's refresh button is clicked. */
function onRefreshRequested(handler) {
  refreshHandler = handler;
}

function computeOrigin(position) {
  const { workArea } = screen.getPrimaryDisplay();
  const x =
    position === 'top-left'
      ? workArea.x + EDGE_MARGIN
      : workArea.x + workArea.width - WIDTH - EDGE_MARGIN;
  const y = workArea.y + EDGE_MARGIN;
  return { x: Math.round(x), y: Math.round(y) };
}

function ensureWindow() {
  if (win && !win.isDestroyed()) return win;

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: true,
    focusable: false,
    show: false,
    // 'hud' is a fixed dark panel regardless of system appearance; 'popover'
    // is the vibrancy material that actually follows light/dark mode.
    vibrancy: 'popover',
    visualEffectState: 'active',
    roundedCorners: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', 'renderer', 'overlay-preload.js'),
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));

  win.on('closed', () => {
    win = null;
  });

  return win;
}

/** Updates the remembered corner and repositions the window if it's open. */
function setPosition(position) {
  currentPosition = position === 'top-left' ? 'top-left' : 'top-right';
  if (win && !win.isDestroyed()) {
    const { x, y } = computeOrigin(currentPosition);
    win.setPosition(x, y);
  }
}

function show(position) {
  if (position) currentPosition = position === 'top-left' ? 'top-left' : 'top-right';
  const w = ensureWindow();
  const { x, y } = computeOrigin(currentPosition);
  w.setPosition(x, y);
  w.showInactive(); // never steals focus from the frontmost app
}

function hide() {
  if (win && !win.isDestroyed()) {
    win.hide();
  }
}

/** Toggles visibility and returns the resulting visible state. */
function toggle(position) {
  if (win && !win.isDestroyed() && win.isVisible()) {
    hide();
    return false;
  }
  show(position);
  return true;
}

function isVisible() {
  return !!win && !win.isDestroyed() && win.isVisible();
}

function sendUsageUpdate(payload) {
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send('usage:update', payload);
  }
}

module.exports = { show, hide, toggle, isVisible, setPosition, sendUsageUpdate, onRefreshRequested };
