# MiniLibrarian

Cross-platform Electron app for browsing Korg minilogue xd Sound Librarian
libraries and individual program exports. The same source runs on macOS,
Windows, and Linux. It does not need an internet connection at runtime.

## Use

On macOS, launch the universal [MiniLibrarian.app](dist/MiniLibrarian.app), or
install with the DMG or ZIP in `release/`. On Windows and Linux, use the
installer or AppImage in `release/`.

Run `npm start`, choose **Open Library**, and select a `.mnlgxdlib` or
`.mnlgxdprog` file. Search the program list, inspect raw synth settings and
stored sequencer events, and use **Save Program…** to export a selected
program. Export preserves that program's original 1,024-byte binary record and
its programmer/comment metadata.

Settings are shown as stored integers; synth display conversions are not
applied. Sequencer data is shown as stored, including events on disabled steps.
The app does not edit programs or simulate playback.

## Receive programs from the synth

Connect the minilogue xd over USB and click **Detect**. The app automatically
pairs its KBD/KNOB input and SOUND output, then searches MIDI channels when you
start a receive. Choose a program range. **Receive programs** requests each
selected slot and saves one program as `.mnlgxdprog` or multiple programs as
`.mnlgxdlib`. A range of 1–500 backs up the full program bank. The generated
library currently contains program records only; it does not receive
favorites, tuning tables, or user units.

The transfer uses Web MIDI with System Exclusive access. Program request and
dump layouts follow the recovered Sound Librarian protocol documented in
[`analysis/sysex-transport.md`](analysis/sysex-transport.md). Hardware
compatibility has not yet been fully validated against a connected minilogue
xd; start with one program. The app reports detected endpoints and the channel
it finds.

## Build installers

Install dependencies with `npm ci`, then build on each target operating system:

```sh
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Installers and archives are written to `release/`. macOS output is a universal
DMG and ZIP for Intel and Apple Silicon Macs. Windows output is an x64 NSIS
installer and portable executable. Linux output is an x64 AppImage. Optional
ARM64 Windows and Linux builds are available with `npm run dist:win:arm64` and
`npm run dist:linux:arm64`.

## Research tools

The `tools/` directory contains read-only Python tools and reverse-engineering
notes for Korg minilogue xd Sound Librarian 1.0.5. Python's standard library is
sufficient to inspect sample files as JSON:

```sh
python3 tools/inspect_library.py Before.mnlgxdprog --sequencer
python3 tools/inspect_library.py /path/to/MinilogueXDLibrary.mnlgxdlib
```

Parameter offsets come from Korg's MIDI specification and were checked against
the supplied library. Cutoff also has controlled before/after export
validation. Values are raw stored integers, not necessarily synth display
values. Research findings and limitations are in [analysis/README.md](analysis/README.md).
