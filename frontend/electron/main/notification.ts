import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { RENDERER_DIST, VITE_DEV_SERVER_URL } from "./config";

const ANIMATION_DURATION = 100;         // duration for slide in/out in ms
const DISMISS_DELAY = 4000;               // time (ms) before auto-dismiss
const NOTIFICATION_WIDTH = 320;           // notification window width in px
const NOTIFICATION_HEIGHT = 100;          // notification window height in px
const INITIAL_Y = -100;                   // initial y-position (off-screen above)
const FINAL_Y = 10;                       // final y-position when visible
const ANIMATION_INTERVAL = 16;            // roughly 60 fps

let notificationWindow: BrowserWindow | null = null;
let pendingNotificationDetails: any = null;
let dismissTimer: NodeJS.Timeout | null = null;

/**
 * Animates the window's y-position from startY to finalY over the specified duration.
 */
function animateWindowY(
  window: BrowserWindow,
  startY: number,
  finalY: number,
  duration: number,
  onComplete: () => void
) {
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration) {
      window.setPosition(window.getBounds().x, finalY);
      clearInterval(interval);
      onComplete();
    } else {
      const progress = elapsed / duration;
      const currentY = startY + (finalY - startY) * progress;
      window.setPosition(window.getBounds().x, Math.round(currentY));
    }
  }, ANIMATION_INTERVAL);
}

/**
 * Slides in the notification window by animating its y-position from off-screen to FINAL_Y.
 */
function slideInNotification(window: BrowserWindow, finalY: number, duration: number = ANIMATION_DURATION) {
  const startY = -window.getBounds().height; // start fully off-screen above
  animateWindowY(window, startY, finalY, duration, () => {
    // Animation complete.
  });
}

/**
 * Slides out the notification window by animating its y-position off-screen.
 */
function slideOutNotification(window: BrowserWindow, duration: number = ANIMATION_DURATION, onComplete: () => void) {
  const startY = window.getBounds().y;
  const finalY = -window.getBounds().height;
  animateWindowY(window, startY, finalY, duration, onComplete);
}

/**
 * Creates a new notification window.
 */
export function createNotificationWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  notificationWindow = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    x: width / 2 - NOTIFICATION_WIDTH / 2,
    y: INITIAL_Y, // start off-screen above
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    const devUrl = VITE_DEV_SERVER_URL.replace(/\/$/, "");
    const notificationUrl = `${devUrl}/notification.html`;
    console.log("Loading notification from dev URL:", notificationUrl);
    notificationWindow.loadURL(notificationUrl);
  } else {
    const notificationHtml = path.join(RENDERER_DIST, "notification.html");
    notificationWindow.loadFile(notificationHtml);
  }

  notificationWindow.setMenuBarVisibility(false);
}

/**
 * Hides the notification window by sliding it out and then closing it.
 */
function hideNotification() {
  if (notificationWindow) {
    slideOutNotification(notificationWindow, ANIMATION_DURATION, () => {
      notificationWindow!.close();
      notificationWindow = null;
    });
  }
}

/**
 * Sets up the IPC handlers for notification window events.
 * The Notification renderer will send a "notification-ready" event when it has mounted.
 */
export function setupNotificationHandlers() {
  // When the renderer signals it's ready, if there are pending details, send them.
  ipcMain.on("notification-ready", () => {
    if (notificationWindow && pendingNotificationDetails) {
      notificationWindow.webContents.send("update-notification", pendingNotificationDetails);
      pendingNotificationDetails = null;
    }
  });

  // Show notification: update content, slide in if needed, and (re)start the auto-dismiss timer.
  ipcMain.on("show-notification", (event, details) => {
    console.log("Received show-notification with details:", details?.direction);
    if (!notificationWindow) {
      pendingNotificationDetails = details;
      createNotificationWindow();
      notificationWindow!.webContents.once("did-finish-load", () => {
        slideInNotification(notificationWindow!, FINAL_Y, ANIMATION_DURATION);
        notificationWindow!.webContents.send("update-notification", details);
        if (dismissTimer) {
          clearTimeout(dismissTimer);
        }
        dismissTimer = setTimeout(() => {
          hideNotification();
          dismissTimer = null;
        }, DISMISS_DELAY);
      });
    } else {
      // If the notification window is already open, update its content and reset the dismiss timer.
      notificationWindow.show();
      notificationWindow.webContents.send("update-notification", details);
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
      dismissTimer = setTimeout(() => {
        hideNotification();
        dismissTimer = null;
      }, DISMISS_DELAY);
    }
  });

  // In case the renderer (or something else) sends a hide-notification event.
  ipcMain.on("hide-notification", () => {
    if (notificationWindow) {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
      slideOutNotification(notificationWindow, ANIMATION_DURATION, () => {
        notificationWindow!.close();
        notificationWindow = null;
      });
    }
  });
}
