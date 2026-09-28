const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------- settings ----------
const DEFAULTS = {
  charm: 'nazar',
  cord: 'gold',
  length: 'medium',
  size: 'medium',
  anchorX: 0.72,      // fraction of screen width
  breeze: true,
  visible: true,
};
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
let settings;
let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); } catch {}
  }, 300);
}

const CHARMS = [
  ['nazar', 'Nazar'], ['nimbu', 'Nimbu mirchi'], ['neko', 'Maneki-neko'], ['hamsa', 'Hamsa'],
  ['clover', 'Four-leaf clover'], ['moon', 'Crescent moon'], ['daruma', 'Daruma'], ['knot', 'Fortune knot'],
];
const CORDS = [['gold', 'Gold chain'], ['silver', 'Silver chain'], ['red', 'Red thread'], ['cotton', 'Cotton thread']];
const LENGTHS = [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']];
const SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];

let win = null;
let tray = null;

// ---------- overlay window ----------
function createWindow() {
  const d = screen.getPrimaryDisplay();
  const { x, y, width } = d.bounds;
  // A strip across the top of the screen, tall enough for the longest cord + largest charm.
  const height = Math.min(720, d.bounds.height);

  win = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  // Clicks pass through to whatever is underneath, except when the pointer is over the charm.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', pushSettings);
  if (!settings.visible) win.hide();
}

function pushSettings() {
  if (win && !win.isDestroyed()) win.webContents.send('settings', settings);
}

function update(partial) {
  settings = { ...settings, ...partial };
  saveSettings();
  pushSettings();
  if ('visible' in partial && win) (settings.visible ? win.showInactive() : win.hide());
  buildTrayMenu();
}

// ---------- tray ----------
function radioGroup(list, key) {
  return list.map(([id, label]) => ({
    label, type: 'radio', checked: settings[key] === id, click: () => update({ [key]: id }),
  }));
}
function buildTrayMenu() {
  if (!tray) return;
  const startup = app.getLoginItemSettings().openAtLogin;
  const menu = Menu.buildFromTemplate([
    { label: settings.visible ? 'Hide charm' : 'Show charm', click: () => update({ visible: !settings.visible }) },
    { type: 'separator' },
    { label: 'Charm', submenu: radioGroup(CHARMS, 'charm') },
    { label: 'Cord', submenu: radioGroup(CORDS, 'cord') },
    { label: 'String length', submenu: radioGroup(LENGTHS, 'length') },
    { label: 'Charm size', submenu: radioGroup(SIZES, 'size') },
    { label: 'Gentle breeze', type: 'checkbox', checked: settings.breeze, click: (i) => update({ breeze: i.checked }) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: startup,
      click: (i) => { app.setLoginItemSettings({ openAtLogin: i.checked }); buildTrayMenu(); } },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  return menu;
}
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Desk Charms');
  tray.on('click', () => update({ visible: !settings.visible }));
  buildTrayMenu();
}

// ---------- IPC ----------
let ignoring = true;
ipcMain.on('set-ignore', (_e, ignore) => {
  if (!win || ignore === ignoring) return;
  ignoring = ignore;
  win.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on('update-settings', (_e, partial) => update(partial));
ipcMain.on('show-menu', () => { const m = buildTrayMenu(); if (m && win) m.popup({ window: win }); });

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    settings = loadSettings();
    createWindow();
    createTray();
    // Rebuild the strip if the screen layout changes (resolution, docking, etc.)
    const rebuild = () => { if (win) { win.destroy(); } createWindow(); };
    screen.on('display-metrics-changed', rebuild);
    screen.on('display-added', rebuild);
    screen.on('display-removed', rebuild);
  });
  app.on('window-all-closed', (e) => e.preventDefault()); // live in the tray
}
