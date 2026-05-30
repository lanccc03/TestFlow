import { app, BrowserWindow, shell } from "electron";
import path from "node:path";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

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

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
