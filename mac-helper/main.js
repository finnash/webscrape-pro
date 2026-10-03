const { app, BrowserWindow, globalShortcut, ipcMain, screen, systemPreferences, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

const cfgPath = () => path.join(app.getPath("userData"), "config.json");
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), "utf8")); } catch { return {}; } };
const writeCfg = (c) => fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2));

let win;
app.dock?.hide();

function create() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 380, height: 460, x: width - 400, y: 40,
    frame: false, transparent: true, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile("index.html");
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") await systemPreferences.askForMediaAccess("microphone");
  create();
  // Option+Space: show + start/stop listening
  globalShortcut.register("Alt+Space", () => { win.showInactive(); win.webContents.send("toggle"); });
  globalShortcut.register("Alt+Shift+Space", () => (win.isVisible() ? win.hide() : win.showInactive()));
});
app.on("will-quit", () => globalShortcut.unregisterAll());

ipcMain.handle("cfg:get", () => readCfg());
ipcMain.handle("cfg:set", (_e, c) => { writeCfg({ ...readCfg(), ...c }); return readCfg(); });
ipcMain.handle("notify", (_e, title, body) => new Notification({ title, body }).show());
ipcMain.handle("hide", () => win.hide());
ipcMain.handle("quit", () => app.quit());
