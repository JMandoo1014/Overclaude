'use strict';

const { BrowserWindow, session } = require('electron');

const PARTITION = 'persist:overclaude';
const LOGIN_URL = 'https://claude.ai/login';

// Paths that mean "still authenticating" — once the window navigates to a
// claude.ai URL outside of these, we consider login complete.
const AUTH_PATH_PREFIXES = ['/login', '/signup', '/oauth', '/join'];

function isStillAuthenticating(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname !== 'claude.ai') return true; // not on claude.ai yet (e.g. Google OAuth)
    return AUTH_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch (err) {
    return true;
  }
}

/**
 * Opens a login window against claude.ai, waits for the user to complete
 * login, then collects the session cookies as a "name=value; ..." header
 * string. Resolves with that string, or rejects if the window is closed
 * before login completes.
 */
function collectLoginCookies() {
  return new Promise((resolve, reject) => {
    const ses = session.fromPartition(PARTITION);

    const win = new BrowserWindow({
      width: 480,
      height: 720,
      title: 'Log in to Claude',
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let settled = false;

    const finish = async () => {
      if (settled) return;
      try {
        const cookies = await ses.cookies.get({ domain: 'claude.ai' });
        if (!cookies || cookies.length === 0) {
          return; // not actually logged in yet, keep waiting
        }
        settled = true;
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        win.removeAllListeners('closed');
        win.close();
        resolve(cookieHeader);
      } catch (err) {
        if (!settled) {
          settled = true;
          win.removeAllListeners('closed');
          win.close();
          reject(err);
        }
      }
    };

    const onNavigate = (event, url) => {
      if (!isStillAuthenticating(url)) {
        finish();
      }
    };

    win.webContents.on('did-navigate', onNavigate);
    win.webContents.on('did-navigate-in-page', onNavigate);

    win.on('closed', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Login window closed before authentication completed.'));
      }
    });

    win.loadURL(LOGIN_URL);
  });
}

module.exports = { collectLoginCookies, PARTITION };
