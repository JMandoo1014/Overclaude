'use strict';

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const COOKIE_FILE = 'overclaude-session.enc';
const ORG_FILE = 'overclaude-org.json';

function cookieFilePath() {
  return path.join(app.getPath('userData'), COOKIE_FILE);
}

function orgFilePath() {
  return path.join(app.getPath('userData'), ORG_FILE);
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

module.exports = {
  saveCookies,
  loadCookies,
  clearCookies,
  saveOrgUuid,
  loadOrgUuid,
  clearOrgUuid,
};
