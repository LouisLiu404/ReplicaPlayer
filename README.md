# Replica Player

Replica Player is a macOS-only Electron music player for local files. It keeps a persistent indexed library of tracked folders, reads embedded metadata and artwork, plays local audio through Chromium, and renders local synced or plain lyrics.

## Current State

- Desktop app shell built with Electron Forge, webpack, React, and TypeScript
- Resizable movable macOS window: opens at its `1280 x 700` minimum
- Persistent tracked folders managed from the in-app `Settings` view
- Local library indexing with SQLite under Electron `userData`
- Playback support for `mp3`, `flac`, `ogg`, and `oga`
- Metadata display:
  - title
  - artist
  - album
  - album artist
  - track / disc numbers
  - year
  - genre
  - duration
  - bitrate
  - sample rate
  - bit depth
  - embedded artwork
- Lyrics support:
  - adjacent `.lrc`
  - embedded timestamped lyrics stored in text lyric frames
  - embedded synced lyric frames
  - embedded plain lyrics
  - adjacent `.txt`
- Real-time synced lyric highlighting in the expanded player
- Queue, lyrics, and details tabs in the expanded player
- Bottom player with:
  - transport controls
  - repeat-all / repeat-one / shuffle
  - top-edge seek bar
  - persistent volume
- Folder rescan modal with live progress and scanned file names
- Missing-track detection and cleanup prompt
- Sandboxed renderer with preload-only IPC and custom `replica-media://` protocol access

## Tech Stack

- Electron 40
- Electron Forge + webpack
- React 19
- TypeScript
- `music-metadata`
- `node:sqlite`
- Heroicons

## Requirements

- macOS
- Node.js 24+
- npm

## Install

```bash
npm install
```

## Development

Start the app in development:

```bash
npm start
```

Run type-checking:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

## Build

Create a packaged app bundle:

```bash
npm run package
```

This writes the packaged app under `out/`, for example:

```text
out/Replica Player-darwin-arm64/Replica Player.app
```

Create Forge distributables:

```bash
npm run make
```

The current Forge setup produces a macOS ZIP target.

## Usage

1. Open `Settings`.
2. Add one or more local music folders.
3. Replica Player immediately starts a rescan and shows scan progress in a modal.
4. Select `All folders` or an individual tracked folder from the left rail.
5. Double-click a track to play it.
6. Click the footer cover art or chevron to open the expanded player.

## Lyrics Resolution Order

Replica Player resolves lyrics in this order:

1. adjacent `.lrc`
2. embedded synced lyrics
3. embedded text lyrics that contain LRC timestamps
4. embedded plain lyrics
5. adjacent `.txt`

Synced lyrics are normalized into timestamped line entries before rendering.

## Library And Persistence

Tracked folders are stored between launches. The app indexes files in place and does not copy music into an app-managed library.

Electron `userData` stores:

- `library.sqlite`
- `artwork/`
- saved root metadata

## Scan Behavior

- Adding folders triggers an immediate rescan
- Manual rescans use the same modal
- Unchanged files are skipped unless the app needs to refresh stale lyric metadata
- Missing files are marked missing on rescan
- Missing tracks can be removed from the library index from the UI
- Unavailable roots remain tracked and are marked offline instead of being deleted

## Playback Notes

- Chromium handles decoding for playback
- `ogg` support depends on whether the codec inside the container is supported by Chromium
- Playback mode defaults to `repeat-all` and persists across restarts
- Volume defaults to `100%` and persists across restarts

## Performance Notes

- Folder track queries are cached between reloads
- Search uses deferred updates
- The UI shows explicit loading states while library queries refresh
- Artwork-derived animated streamer effects are scoped to the lyrics surface, not the entire app shell

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
    window-options.ts
  renderer/
    components/
    App.tsx
    index.tsx
    lyrics-scroll.ts
    playback.ts
    streamer.ts
    styles.css
    utils.ts
  preload.ts
  shared/
    types.ts
```

## Tests

The current test suite covers:

- lyric parsing and precedence
- MP3 embedded LRC-in-text normalization
- lyrics scroll centering
- window option regressions
- playback mode cycling and persistence helpers
- navigation rail behavior

## Limitations

- macOS only
- minimum supported window size is `1280 x 700`
- manual rescan only, no background watching
- local files only
- no playlists
- no streaming integrations
- no cloud sync
- `node:sqlite` may emit an experimental warning at startup

## Troubleshooting

- If development behavior looks stale after changing webpack, CSP, preload, or protocol code, stop the current process and run `npm start` again.
- If an already-indexed MP3 was missing embedded lyrics before a parser fix, run a manual rescan once to refresh the stored lyric payload.
- If an Ogg file fails to play, the container may be valid while the embedded codec is not supported by Chromium.

## License

MIT
