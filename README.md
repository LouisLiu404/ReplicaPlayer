# Replica Player

Replica Player is a macOS-only Electron music player for local files. It indexes music in place, persists library roots between launches, reads embedded metadata, shows album art, and displays local synced or plain lyrics.

## Features

- Persistent local library management. Imported folders are stored and do not need to be re-added on every launch.
- Supported playback formats: `mp3`, `flac`, `ogg`, `oga`.
- Metadata parsing with [`music-metadata`](https://www.npmjs.com/package/music-metadata):
  - title
  - artist
  - album
  - album artist
  - track and disc numbers
  - year
  - genre
  - duration
  - bitrate
  - sample rate
  - bit depth
  - embedded artwork
- Lyrics support:
  - adjacent `.lrc`
  - embedded synced lyrics
  - embedded plain lyrics
  - adjacent `.txt`
- Real-time synced lyric highlighting.
- Manual rescan flow with a modal progress view that lists scanned file names in order.
- Cached folder-playlist queries and explicit loading states for faster folder switching.
- Missing-track cleanup prompt so deleted files can be removed from the library index.
- Fixed-size desktop window tuned for the current macOS layout.
- Sandboxed renderer with preload-only IPC and custom protocols instead of direct `file://` access.

## Stack

- Electron 40
- Electron Forge + webpack
- React 19 + TypeScript
- `music-metadata`
- `node:sqlite`

## Requirements

- macOS
- Node.js 24 or newer
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm start
```

Type-check:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Build a packaged app:

```bash
npm run package
```

Create Forge distributables:

```bash
npm run make
```

## How It Works

1. Open `Settings` from the sidebar and add one or more music folders.
2. Replica Player stores the canonical root paths under Electron `userData`.
3. A manual rescan opens a modal, walks each saved root, parses changed files, and updates the SQLite index.
4. The renderer queries the indexed library over preload IPC.
5. Playback and artwork are served through a privileged custom protocol and converted to `blob:` URLs in the renderer.

## Lyrics Priority

Lyrics are resolved in this order:

1. adjacent same-name `.lrc`
2. embedded synced lyrics
3. embedded plain lyrics
4. adjacent same-name `.txt`

Synced lyrics are normalized into timestamped line entries and highlighted against the current playback position.

## Persistence

App data is stored in Electron `userData` and includes:

- `library.sqlite`
- `artwork/`
- saved library root metadata

The app indexes files in place. It does not copy music into an app-managed media folder.

## Scan UX

- Adding folders triggers an immediate rescan modal.
- Manual rescans use the same modal.
- The modal shows:
  - current scan phase
  - processed vs discovered file counts
  - scanned file names in order
  - an `OK` button when the scan completes or fails

## Performance Notes

- Folder playlist queries are cached between rescans, so switching back to an already-opened folder scope is immediate.
- Search input uses deferred updates to avoid blocking the renderer on rapid typing.
- When a query still takes time, the app shows explicit loading UI instead of leaving the track list looking unresponsive.

## Project Layout

```text
src/
  main/
    library/
      library-service.ts
      library-worker.ts
      lyrics.ts
      repository.ts
      scanner.ts
    main.ts
    protocols.ts
  renderer/
    App.tsx
    index.tsx
    styles.css
  preload.ts
  shared/
    types.ts
```

## Architecture

- Main process:
  - creates the window
  - registers IPC handlers
  - registers custom protocols
- Library worker:
  - owns SQLite access
  - scans folders
  - parses metadata and lyrics
  - resolves media and artwork paths
- Renderer:
  - shows library state
  - manages playback UI
  - renders metadata and lyrics

## Current Limitations

- macOS only
- fixed-size window, no user resizing
- manual rescan only, no background file watching
- local lyrics only, no online lyric provider
- no playlists
- no streaming services
- no cloud sync
- Ogg support depends on Chromium being able to decode the codec inside the Ogg container
- `node:sqlite` may print an experimental warning on startup

## Troubleshooting

If you change webpack, Forge, CSP, or protocol configuration during development, stop the current dev process and run `npm start` again. Restarting only the Electron main process does not refresh the webpack dev-server headers.

If playback fails for a specific Ogg file, the container may be valid while the embedded codec is not supported by Chromium.

## License

MIT
