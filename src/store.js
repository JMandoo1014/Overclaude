'use strict';

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const COOKIE_FILE = 'overclaude-session.enc';
const ORG_FILE = 'overclaude-org.json';
const SETTINGS_FILE = 'overclaude-settings.json';

const DEFAULT_PANEL_POSITION = 'top-right';
const VALID_PANEL_POSITIONS = new Set(['top-left', 'top-right']);

function cookieFilePath() {
  return path.join(app.getPath('userData'), COOKIE_FILE);
}

function orgFilePath() {
  return path.join(app.getPath('userData'), ORG_FILE);
}

function settingsFilePath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function loadSettings() {
  const filePath = settingsFilePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
  } catch (err) {
    return {};
  }
}

function saveSettings(patch) {
  const merged = { ...loadSettings(), ...patch };
  fs.writeFileSync(settingsFilePath(), JSON.stringify(merged, null, 2));
}

/**
 * Persist the given cookie header string, encrypted via the OS keychain
 * (safeStorage). Throws if the OS does not support encryption.
 */
function saveCookies(cookieHeader) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption (safeStorage) is not available on this machine.');
  }
  const encrypted = safeStorage.encryptString(cookieHeader);
  fs.writeFileSync(cookieFilePath(), encrypted);
}

/**
 * Load and decrypt the stored cookie header string.
 * Returns null if nothing has been saved yet.
 */
function loadCookies() {
  const filePath = cookieFilePath();
  if (!fs.existsSync(filePath)) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption (safeStorage) is not available on this machine.');
  }
  try {
    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  } catch (err) {
    // Corrupted or undecryptable (e.g. keychain access revoked) — treat as absent.
    return null;
  }
}

function clearCookies() {
  const filePath = cookieFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function saveOrgUuid(uuid) {
  fs.writeFileSync(orgFilePath(), JSON.stringify({ uuid }, null, 2));
}

function loadOrgUuid() {
  const filePath = orgFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data && typeof data.uuid === 'string' ? data.uuid : null;
  } catch (err) {
    return null;
  }
}

function clearOrgUuid() {
  const filePath = orgFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function savePanelPosition(position) {
  const value = VALID_PANEL_POSITIONS.has(position) ? position : DEFAULT_PANEL_POSITION;
  saveSettings({ panelPosition: value });
}

function loadPanelPosition() {
  const { panelPosition } = loadSettings();
  return VALID_PANEL_POSITIONS.has(panelPosition) ? panelPosition : DEFAULT_PANEL_POSITION;
}

function savePanelVisible(visible) {
  saveSettings({ panelVisible: !!visible });
}

function loadPanelVisible() {
  const { panelVisible } = loadSettings();
  return !!panelVisible;
}

module.exports = {
  saveCookies,
  loadCookies,
  clearCookies,
  saveOrgUuid,
  loadOrgUuid,
  clearOrgUuid,
  savePanelPosition,
  loadPanelPosition,
  savePanelVisible,
  loadPanelVisible,
};
