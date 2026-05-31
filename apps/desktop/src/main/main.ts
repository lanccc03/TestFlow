import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";

import { BackendProcessManager } from "./backend-process.js";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const BACKEND_HOST = process.env.TESTFLOW_BACKEND_HOST ?? "127.0.0.1";
const BACKEND_PORT = Number(process.env.TESTFLOW_BACKEND_PORT ?? "8000");
const BACKEND_HEALTH_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`;

let backendManager: BackendProcessManager | undefined;

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
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
  const backendCwd =
    process.env.TESTFLOW_BACKEND_CWD ??
    (app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.resolve(app.getAppPath(), "../..", "backend"));
  const command = process.env.TESTFLOW_BACKEND_COMMAND ?? "uv";
  const args = process.env.TESTFLOW_BACKEND_ARGS
    ? process.env.TESTFLOW_BACKEND_ARGS.split(" ")
    : [
        "run",
        "fastapi",
        "dev",
        "app/main.py",
        "--host",
        BACKEND_HOST,
        "--port",
        String(BACKEND_PORT),
      ];

  return new BackendProcessManager({
    args,
    command,
    cwd: backendCwd,
    healthUrl: BACKEND_HEALTH_URL,
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

app.on("before-quit", () => {
  void backendManager?.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
