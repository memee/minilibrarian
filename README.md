# MiniLibrarian

MiniLibrarian is a cross-platform Electron app for browsing Korg minilogue xd
sound libraries and backing up programs from the synthesizer. It runs on macOS,
Windows, and Linux and does not require an internet connection at runtime.

## Features

- Open `.mnlgxdlib` libraries and `.mnlgxdprog` program files.
- Search programs and inspect stored parameter values and sequencer events.
- Export an individual program while preserving its original binary record and
  programmer/comment metadata.
- Receive programs over USB MIDI. The app detects the synth's KBD/KNOB and SOUND
  endpoints and finds its MIDI channel automatically.
- Save one received program as `.mnlgxdprog` or a range as `.mnlgxdlib`.

Receiving all 500 programs has been confirmed with a connected minilogue xd.
Received libraries currently contain program records only; favorites, tuning
tables, and user units are not included. Program settings are shown as stored
integers, without synth-display conversions. Editing and playback are not yet
implemented.

## Run from source

Install Node.js, then run:

```sh
npm ci
npm start
```

Choose **Open Library** to browse a `.mnlgxdlib` or `.mnlgxdprog` file. To receive
programs, connect the minilogue xd over USB, click **Detect**, choose the
program range, and click **Receive programs**. The app requests MIDI System
Exclusive access from the operating system.

## Build installers

Run the build on the target platform:

```sh
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Build outputs go in `release/` and are intentionally excluded from Git. macOS
produces a universal DMG and ZIP for Intel and Apple Silicon. Windows produces
an x64 NSIS installer and portable app. Linux produces an x64 AppImage. ARM64
Windows and Linux builds are available with `npm run dist:win:arm64` and
`npm run dist:linux:arm64`.

## Reverse-engineering notes

The `analysis/` directory documents the file format, MIDI transfer protocol,
parameter mappings, and limitations found while studying Korg's minilogue xd
Sound Librarian. The `tools/` directory contains read-only Python inspection
tools. For example:

```sh
python3 tools/inspect_library.py path/to/program.mnlgxdprog --sequencer
python3 tools/inspect_library.py path/to/library.mnlgxdlib
```

Synth libraries and individual exported patches are ignored by Git because
they may contain personal sound data. Research findings and evidence are
summarized in [analysis/README.md](analysis/README.md).
