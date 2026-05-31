import { contextBridge, ipcRenderer } from "electron";

type BackendStatus = {
  state: "stopped" | "starting" | "running" | "failed" | "exited";
  healthUrl: string;
  message?: string;
  pid?: number;
};

contextBridge.exposeInMainWorld("testflow", {
  desktop: {
    getInfo: () => ipcRenderer.invoke("desktop:get-info"),
    platform: process.platform,
    versions: {
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
    },
  },
  backend: {
    getStatus: () => ipcRenderer.invoke("backend:get-status"),
    onStatusChange: (callback: (status: BackendStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: BackendStatus) => {
        callback(status);
      };
      ipcRenderer.on("backend:status-changed", listener);
      return () => {
        ipcRenderer.removeListener("backend:status-changed", listener);
      };
    },
    start: () => ipcRenderer.invoke("backend:start"),
  },
});
