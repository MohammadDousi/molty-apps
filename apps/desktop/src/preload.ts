import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("molty", {
  getApiBase: () => ipcRenderer.invoke("get-api-base")
});
