const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("meow", {
  getCfg: () => ipcRenderer.invoke("cfg:get"),
  setCfg: (c) => ipcRenderer.invoke("cfg:set", c),
  notify: (t, b) => ipcRenderer.invoke("notify", t, b),
  hide: () => ipcRenderer.invoke("hide"),
  quit: () => ipcRenderer.invoke("quit"),
  onToggle: (fn) => ipcRenderer.on("toggle", fn),
});
