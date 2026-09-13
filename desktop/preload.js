// The setup page needs the server address; the screen itself needs a name to be known by
// in a house with more than one. Nothing else of the computer is exposed to the page.
const { contextBridge, ipcRenderer } = require("electron");
const { hostname } = require("node:os");

contextBridge.exposeInMainWorld("dino", {
  currentServer: () => ipcRenderer.invoke("dino:current-server"),
  saveServer: (value) => ipcRenderer.invoke("dino:save-server", value),
  computerName: hostname(),
});
