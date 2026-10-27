# Program loading and parameter decoding

The reader now decodes 32 raw integer fields from minilogue xd program/library
exports. See `library-parameters.csv` for all 500 programs, or
`library-parameters.json` for hashes, metadata, source information, and warnings.

## What the binary establishes

The app's ZIP reader uses `FileInformation.xml`, `ProgramData`, `Information`,
and `ProgramBinary` to find the program files. These strings are UTF-32LE in
the executable; the initial Hopper string search missed them. Initializer
`0x1001A1C06` associates `ProgramBinary` with global `0x1008DBC50`.
The ZIP reader at `0x10003D6F8` compares XML child names against this global.

Entry constructor `0x10003FEB0` stores the information filename at entry +8,
the binary filename at entry +16, and creates its program object at entry +24.
The ZIP reader looks up both members, reads the binary buffer, and copies
1,024 bytes to that program object's +16. Instruction addresses
`0x10003E38C–0x10003E3A8` verify the copy and subsequent refresh call.
The archive-entry stride is 0x448; the program object occupies 0x430 bytes.

The MIDI sender previously traced at `0x10005D3D6` takes the same 1,024-byte
region at program object +16 for seven-bit packing. Thus the raw file offset
is not adjusted to strip the PROG header or name. A program byte at file
offset 60 resides at object offset 76. The object's 16-byte prefix is separate
from the file's own first 16 bytes.

The name setter `0x100031986` writes at object +0x14, corroborating file offset
4, and formats a maximum 12-character name. The constructor at `0x10003185A`
initializes all 1,024 bytes from a compiled-in default at `0x1001CB17C`.

Evidence IDs:

- ZIP constants initializer: `ev_6e254f9489c91e57d4297a9b56e66d4c318b19ff7d05f95d7498d349fede0189`
- Constant bytes: `ev_6f5bf4a319d1941e5c04756dd5bda4d52534eb29259cd06e6a9a13daba37de4f`
- Entry constructor: `ev_22939d2ae4d809b380e1731fd361c4e25557a6f7d0c05a60917a5686a787caba`
- ZIP loader pseudocode: `ev_03afad5625752f2ef0ad3fa1747e4e24f359362729a32a40915bddc04817a303`
- ZIP loader assembly: `ev_ec069a47f9ef7e1d168a059ac4904f54b4e62cc74a5b38ac2b90379c5e2e114b`
- Program constructor: `ev_d072ff006ae6af62bd4b14006d4df3242ce8af2c2ef0527206f3864d50a1e38e`
- Name setter: `ev_0457d7fc11b90c000d67897ef9f0d4fc02e7b364a3c360b570ee55688aebfab9`

These are static findings from installed version 1.0.5, executable SHA-256
`a3943475b5a46ddab5d79451e9d46c36542c4686cf9d99d8a11d517e53dbb09a`.

## Why the earlier parameter table was not used

Initializer `0x1001A2F88` contains a descriptor table with cutoff offset 44,
oscillator-1 level offset 38, and amp attack offset 54. The actual file offsets
are 60, 54, and 66 respectively. Even the difference is not constant: adding
16 would misidentify amp attack. The initializer also contains split/timbre
fields and other layouts. No active consumer selecting this table for xd
program decoding was established by the inspected references. Its origin and
purpose remain unresolved; it is not used by our decoder.

References to the inspected cutoff/resonance offset globals led only to their
initialization instructions. This bounded negative result does not prove the
table is unused; indirect consumers could exist.
Evidence: `ev_09fc6f7ae13dff4c2078eb8f3df0cd6aab91868fd2309876ff5accc077bbbbac`,
`ev_06b9f898e0aaa849547259680f817d9d1e4c98d26cb1c58f4708037599adf5cc`.

## Mapping source and validation

Parameter names, offsets, and ranges come from Korg's
[MIDI Implementation, revision 1.01 (2020-02-10), Table 2](https://www.korg.com/us/support/download/manual/0/811/4440/).
The downloaded text's SHA-256 is
`f34014c103b0127f5150aa8984db1f890feb9ee4046089e2ed320fadcecaddb5`.
Source URLs and hash are embedded in `tools/program_parameters.py` and the JSON
report. These mappings are documented facts cross-checked with artifacts;
they were not independently recovered from per-parameter code in the app.

The specification labels the earlier byte of two-byte fields H and the next
L. Reading these exports literally in that order contradicts the controlled
cutoff endpoints. We use little-endian order: `FF 03` is 1023. Across 500
programs and 32 fields, all 16,000 little-endian values are within 0–1023;
big-endian decoding puts 6,950 values outside that range. This supports the
encoding but does not independently prove every parameter's semantic identity.
The user_shift_shape field is zero in every library record, so its byte order
is not separately distinguishable from this sample.

Controlled exports validate cutoff at 60–61. Other mappings rely on Table 2
plus range consistency; they have not received individual hardware tests.
The earlier synth display of 613 versus stored 614 remains unexplained.

Example from the original library's first program, Square LPG, in stored units:

| Parameter | File offset | Raw value |
| --- | --- | --- |
| VCO1 level | 54 | 157 |
| VCO2 level | 56 | 3 |
| Multi level | 58 | 1023 |
| Cutoff | 60 | 640 |
| Resonance | 62 | 159 |
| Amp attack | 66 | 0 |
| Amp decay | 68 | 130 |
| Amp sustain | 70 | 0 |
| Amp release | 72 | 319 |

The decoder also covers oscillator pitch/shape, multi-engine shape variants,
voice depth, EG, LFO, and effect time/depth. It reports raw values without
inventing conversions to Hz, seconds, or display values. Full offsets are in
`tools/program_parameters.py`; per-field sample statistics are in
`parameter-validation.json`.

## Checks and remaining scope

All ten tests pass: five codec tests and five parameter/format tests. They
cover controlled export differences, stored sample values, malformed input,
preservation/reporting of out-of-range values, and refusal to apply xd offsets
to another product. The library integration check validated 500 records with
32 fields and zero range warnings.

The app was not launched; no MIDI ports were opened or device data written.
Source exports were read without changes. Raw values are useful for inspection
and comparison. Display conversion, parameter editing, effects/user-unit
semantics, sequencer decoding, and hardware round-trip verification remain
future work. Full evidence is in `program-layout-evidence.json` and a reusable
session snapshot is in `program-layout.snapshot.json`.
