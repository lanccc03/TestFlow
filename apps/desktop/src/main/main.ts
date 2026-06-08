import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "node:path";

import { createBackendProcessOptions } from "./backend-config.js";
import { BackendProcessManager } from "./backend-process.js";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let backendManager: BackendProcessManager | undefined;
let isQuittingAfterBackendStop = false;

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    height: 800,
    minHeight: 640,
    minWidth: 960,
    show: false,
    title: "TestFlow",
    width: 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "../../../web/dist/index.html"));
}

function createBackendManager(): BackendProcessManager {
  const options = createBackendProcessOptions({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  return new BackendProcessManager({
    ...options,
  });
}

function broadcastBackendStatus(): void {
  const status = backendManager?.getStatus();
  if (!status) {
    return;
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("backend:status-changed", status);
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:get-info", () => ({
    platform: process.platform,
    versions: {
      app: app.getVersion(),
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
    },
  }));

  ipcMain.handle("backend:get-status", () => backendManager?.getStatus());
  ipcMain.handle("backend:start", async () => backendManager?.start());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  backendManager = createBackendManager();
  backendManager.onStatusChange(broadcastBackendStatus);
  registerIpcHandlers();
  createMainWindow();

  void backendManager.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("TestFlow backend failed to start", message);
    broadcastBackendStatus();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (isQuittingAfterBackendStop || !backendManager) {
    return;
  }

  event.preventDefault();
  void backendManager.stop().finally(() => {
    isQuittingAfterBackendStop = true;
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
