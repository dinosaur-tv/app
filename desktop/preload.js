// The setup page needs exactly two things from the app and nothing else.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dino", {
  currentServer: () => ipcRenderer.invoke("dino:current-server"),
  saveServer: (value) => ipcRenderer.invoke("dino:save-server", value),
});
