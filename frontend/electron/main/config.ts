import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "../..");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "../../dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "";
