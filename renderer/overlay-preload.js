'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overclaude', {
  onUsageUpdate: (callback) => {
    ipcRenderer.on('usage:update', (_event, payload) => callback(payload));
  },
  requestRefresh: () => {
    ipcRenderer.send('overlay:refresh-request');
  },
});
