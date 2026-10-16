# Dofus Helper

An always-on-top Electron overlay for the MMORPG Dofus that reads treasure-hunt clues from the screen with OCR and tells you which map to travel to next.

## Why

Dofus treasure hunts give you a direction and a clue (a landmark such as a statue or a tree) and you have to find the next map in that direction on which the landmark appears. Looking that up by hand means leaving the game and typing the clue into a lookup tool. This overlay does the lookup in place: it screenshots the hunt panel, recognises the clue text, matches it against a bundled clue database and copies the resulting `/travel` command to the clipboard.

It was built in January and February 2025 by Lucas Keller ([@xD33m](https://github.com/xD33m)) and Felix Keller ([@1-Felix](https://github.com/1-Felix)) as a side project. It is not affiliated with Ankama.

> Screenshot: not yet added (see "To do" below).

## Features

- **Treasure-hunt mode**
  - Enter your current coordinates by hand, or read them from the screen with OCR.
  - Pick a direction with the on-screen arrows or the global hotkeys `Ctrl+Up/Down/Left/Right` (work while the game has focus).
  - Looks up every clue within 10 maps in that direction from a bundled `clues.json` (map positions and clue names in FR, EN, ES, DE and PT).
  - OCR (Tesseract.js, French or German) reads the hunt panel; the text is cleaned and fuzzy-matched (Fuse.js) against the clues that exist in the chosen direction, from the last line upwards.
  - Copies `/travel x,y` for the matched map to the clipboard.
  - Shows a slide-in, always-on-top notification with the clue, direction, distance and coordinates (can be turned off; top or bottom placement).
- **Crop selection**: a full-screen transparent overlay lets you drag the screen region that OCR should read.
- **Language switch**: French or German clues and OCR model (`fra` / `deu`; `eng.traineddata` is also bundled).
- **Item search**: German/French item-name lookup stored in IndexedDB (Dexie), with click-to-copy.

## Tech stack

| Part | Technologies |
| --- | --- |
| Desktop app (`frontend/`) | Electron 33, React 18, TypeScript, Vite 5 with `vite-plugin-electron`, Tailwind CSS, electron-builder, electron-updater |
| OCR and image processing | `screenshot-desktop`, `sharp` (crop, greyscale, gamma, sharpen), Tesseract.js 6 |
| Search and data | Fuse.js (fuzzy matching), Dexie (IndexedDB), static JSON clue and translation data |
| Backend (`backend/`) | Node.js, Express, TypeScript, Docker (multi-stage build, pm2) |
| Data tooling (`scripts/`) | Python |

## Getting started

Requirements: Node.js and npm (the backend Docker image uses Node 20).

### Desktop app

```bash
cd frontend
npm install
npm run dev      # starts Vite and launches Electron
npm run build    # type-checks, builds and packages installers into frontend/release/<version>/
```

electron-builder is configured for Windows (NSIS, x64) and macOS (dmg and zip).

### Backend (optional)

The backend is an early Express skeleton with a placeholder `GET /translate?term=...` endpoint; the desktop app does not call it yet.

```bash
cd backend
npm install
npm run dev      # nodemon + ts-node, listens on PORT (default 3000)
npm run build && npm start
```

Docker: `docker build -t dofus-helper-backend backend/`. Note that the runtime stage uses the `arm64v8/node:20-alpine` base image, so it targets ARM64 hosts.

### Regenerating the translation data

`scripts/parse.py` merges German and French game-text exports (`de.i18n.json`, `fr.i18n.json`) with an item list (`items.json`), keeps only item names and writes `frontend/src/assets/de-fr.i18n.json`. The input files are not committed (they are listed in `.gitignore`).

```bash
python scripts/parse.py   # run from the repository root
```

## Architecture

```
frontend/
  electron/main/      Main process: windows, global hotkeys, screen capture + OCR (IPC "read-dofus-ocr"),
                      crop overlay, notification window, auto-update hook
  electron/preload/   Exposes ipcRenderer to the renderer
  src/components/     React UI: overlay header, hunt view, item search, crop overlay, notification
  src/lib/clues.ts    OCR text cleanup and fuzzy clue matching
  src/db/             Clue lookup by position/direction; IndexedDB translation store
  src/assets/         clues.json, de-fr.i18n.json
backend/              Express skeleton + Dockerfile
scripts/parse.py      Builds the translation JSON from game data exports
```

The renderer asks the main process to capture the screen; the main process crops and pre-processes the image with sharp, runs Tesseract and returns the text. Matching and clue lookup run in the renderer.

## Status and known limitations

Prototype, last worked on in February 2025.

- OCR debug images are written to the user's Downloads folder (`dofus-ocr-debug-1.png`) on every capture.
- DevTools open automatically with the main window.
- `electron-builder.json` still has the template `appId` and update URL, so auto-update is not wired to this repository.
- The GitHub Actions workflows live in `frontend/.github/` and therefore do not run (GitHub only reads workflows from the repository root).

## License

[MIT](LICENSE)
