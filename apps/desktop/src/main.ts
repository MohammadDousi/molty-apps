import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import net from "node:net";
import { createServer } from "@molty/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let apiBase = "";
let resolveApiBase: ((value: string) => void) | null = null;

const apiBaseReady = new Promise<string>((resolve) => {
  resolveApiBase = resolve;
});

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const createTrayIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" fill="black" />
      <path d="M6 9h6" stroke="white" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  `;

  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  );
  icon.setTemplateImage(true);
  return icon;
};

const findAvailablePort = async (startPort: number, attempts = 20): Promise<number> => {
  const isPortFree = (port: number) =>
    new Promise<boolean>((resolve) => {
      const tester = net
        .createServer()
        .once("error", () => resolve(false))
        .once("listening", () => tester.close(() => resolve(true)))
        .listen(port, "127.0.0.1");
    });

  for (let index = 0; index < attempts; index += 1) {
    const port = startPort + index;
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error("No free port found for local server");
};

const createWindow = () => {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 360,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: "#f6f2ea",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, "renderer", "index.html");
    mainWindow.loadURL(pathToFileURL(indexPath).toString());
  }

  mainWindow.on("blur", () => {
    if (!mainWindow?.webContents.isDevToolsOpened()) {
      mainWindow?.hide();
    }
  });

  return mainWindow;
};

const positionWindow = () => {
  if (!tray || !mainWindow) return;

  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 6);

  const minX = display.bounds.x + 8;
  const maxX = display.bounds.x + display.bounds.width - windowBounds.width - 8;
  const maxY = display.bounds.y + display.bounds.height - windowBounds.height - 8;

  const clampedX = Math.min(Math.max(x, minX), maxX);
  const clampedY = Math.min(y, maxY);

  mainWindow.setPosition(clampedX, clampedY, false);
};

const toggleWindow = () => {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  positionWindow();
  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Molty WakaTime");

  tray.on("click", toggleWindow);
  tray.on("right-click", () => {
    const menu = Menu.buildFromTemplate([
      { label: "Open", click: () => toggleWindow() },
      { type: "separator" },
      { role: "quit" }
    ]);
    tray?.popUpContextMenu(menu);
  });
};

const startServer = async () => {
  const port = await findAvailablePort(24680);
  const dataDir = path.join(app.getPath("userData"), "server");
  const server = createServer({ dataDir, port, hostname: "127.0.0.1" });
  server.listen();

  apiBase = `http://127.0.0.1:${port}`;
  resolveApiBase?.(apiBase);

  app.on("before-quit", () => {
    server.app.server?.close();
  });
};

ipcMain.handle("get-api-base", () => apiBaseReady);

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  createTray();
  if (process.platform === "darwin") {
    app.dock.hide();
  }
});

app.on("window-all-closed", (event) => {
  if (process.platform === "darwin") {
    event.preventDefault();
  } else {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
  }
});
