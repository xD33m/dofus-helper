import { app, BrowserWindow, shell, ipcMain, globalShortcut } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { Worker } from "worker_threads";
import { update } from "./update";
import Tesseract, { createWorker } from "tesseract.js";
import sharp from "sharp";
import screenshotDesktop from "screenshot-desktop";
import pkg from "normalize-unicode-text";

const { normalizeUnicodeText } = pkg;

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up paths
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Application state
let win: BrowserWindow | null = null;

// Application setup
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    frame: false,
    resizable: true,
    transparent: true,
    height: 200,
    width: 400,
    webPreferences: {
      preload,
      contextIsolation: true,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver", 1);
  // win.webContents.openDevTools();
  // Load the appropriate URL
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(indexHtml);
  }

  // Open dev tools explicitly after the app is ready
  win.webContents.on("did-finish-load", () => {
    if (win && !win.webContents.isDevToolsOpened()) {
      win.webContents.openDevTools();
    }
  });

  // Handle external link opening
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  update(win);
}

// Register global shortcuts
function registerShortcuts() {
  if (!win) return;
  globalShortcut.register("CommandOrControl+Up", () => {
    win?.focus();
    win?.webContents.send("key-press", "up");
  });
  globalShortcut.register("CommandOrControl+Down", () => {
    win?.focus();
    return win?.webContents.send("key-press", "down");
  });
  globalShortcut.register("CommandOrControl+Left", () => {
    win?.focus();

    return win?.webContents.send("key-press", "left");
  });
  globalShortcut.register("CommandOrControl+Right", () => {
    win?.focus();
    return win?.webContents.send("key-press", "right");
  });
}

// Worker thread for OCR
function runTesseractWorker(buffer: Buffer, lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "./ocr-worker.js"), {
      workerData: { buffer, lang },
    });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

type Options = {
  lang?: string;
  crop?: { left: number; top: number; width: number; height: number };
};

ipcMain.handle("read-dofus-ocr", async (_, options: Options) => {
  const { lang, crop } = options;
  // 1) Capture + OCR
  const ocrText = await captureAndReadOCR(lang, crop);

  return ocrText;
});

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

ipcMain.on("resize-window", (event, { width, height }) => {
  if (win) {
    // Adjust the BrowserWindow size.
    // Optionally add some offsets if you have any padding or window frame.
    win.setSize(width, height);
    // win.setMinimumSize(100, 100);
  }
});

async function captureAndReadOCR(
  lang = "fra",
  crop?: { left: number; top: number; width: number; height: number }
) {
  console.log("🖼️ OCR Lang", lang);
  const debugFilename = path.join(app.getPath("downloads"), `dofus-ocr-debug-1.png`);

  // Capture either full screen or a crop region
  const imgBuffer = await screenshotDesktop({
    filename: debugFilename, // <--- automatically saves to disk
  });

  const cropped = sharp(imgBuffer)
    .extract(crop || { left: 0, top: 80, width: 300, height: 450 })
    .gamma(3)
    .greyscale()
    .normalise()
    .trim()
    .sharpen({ sigma: 2 });

  const croppedBuffer = await cropped.toBuffer();

  cropped.toFile(debugFilename + "-cropped.png");

  console.log("Screenshot saved to:", debugFilename);

  const worker = await createWorker(lang);
  const {
    data: { text },
  } = await worker.recognize(croppedBuffer);
  worker.terminate();

  return text;
}
